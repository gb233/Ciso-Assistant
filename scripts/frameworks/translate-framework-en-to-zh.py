#!/usr/bin/env python3
"""Translate one framework dataset from EN source into ZH target.

The script keeps `<id>-en.json` as the canonical source and updates `<id>.json`
as the converted Chinese version.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

CJK_RE = re.compile(r"[\u3400-\u9FFF]")
LATIN_RE = re.compile(r"[A-Za-z]")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def split_text(text: str, limit: int) -> List[str]:
    if len(text) <= limit:
        return [text]

    parts: List[str] = []
    lines = text.split("\n")
    buf: List[str] = []
    buf_len = 0

    for line in lines:
        next_len = len(line) + 1
        if buf and (buf_len + next_len) > limit:
            parts.append("\n".join(buf))
            buf = [line]
            buf_len = next_len
        else:
            buf.append(line)
            buf_len += next_len

    if buf:
        parts.append("\n".join(buf))

    return parts


def google_translate(text: str, timeout: int) -> str:
    query = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": "en",
            "tl": "zh-CN",
            "dt": "t",
            "q": text,
        }
    )
    url = f"https://translate.googleapis.com/translate_a/single?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    segments = body[0] if isinstance(body, list) and body else []
    translated = "".join((seg[0] or "") for seg in segments if isinstance(seg, list) and seg).strip()
    if not translated:
        raise RuntimeError("empty translation response")
    return translated


def translate_with_retry(text: str, retries: int, sleep_base: float, timeout: int) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return google_translate(text, timeout=timeout)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(sleep_base * attempt)
    raise RuntimeError(f"translation failed after {retries} retries: {last_error}")


def translate_long_text(text: str, chunk_size: int, retries: int, sleep_base: float, timeout: int) -> str:
    chunks = split_text(text, limit=chunk_size)
    translated_chunks: List[str] = []
    for chunk in chunks:
        translated_chunks.append(
            translate_with_retry(chunk, retries=retries, sleep_base=sleep_base, timeout=timeout)
        )
        time.sleep(0.12)
    return "\n".join(translated_chunks).strip()


def looks_like_identifier(value: str) -> bool:
    v = value.strip()
    if not v:
        return True
    if re.match(r"^https?://", v, re.IGNORECASE):
        return True
    if re.match(r"^[0-9]+([.:-][0-9A-Za-z]+)*$", v):
        return True
    if re.match(r"^[A-Z0-9_.:/-]{2,}$", v) and " " not in v:
        return True
    if re.match(r"^[A-Za-z0-9_.:/-]{1,30}$", v) and " " not in v:
        return True
    return False


def should_translate_en_text(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    if CJK_RE.search(text):
        return False
    if not LATIN_RE.search(text):
        return False
    if looks_like_identifier(text):
        return False
    return True


def req_key(req: Dict[str, Any], fallback_idx: int) -> str:
    rid = str(req.get("id", "")).strip()
    if rid:
        return f"id:{rid}"
    code = str(req.get("code", "")).strip()
    if code:
        return f"code:{code}"
    return f"idx:{fallback_idx}"


class Translator:
    def __init__(
        self,
        en_data: Dict[str, Any],
        zh_data: Dict[str, Any],
        cache: Dict[str, str],
        zh_path: Path,
        cache_path: Path,
        persist_every: int,
        chunk_size: int,
        retries: int,
        sleep_base: float,
        timeout: int,
        force: bool,
        translate_names: bool,
        translate_verification: bool,
        workers: int,
        cache_flush_every: int,
        result_attempts: int,
        progress_every: int,
    ) -> None:
        self.en_data = en_data
        self.zh_data = zh_data
        self.cache = cache
        self.zh_path = zh_path
        self.cache_path = cache_path
        self.persist_every = persist_every
        self.chunk_size = chunk_size
        self.retries = retries
        self.sleep_base = sleep_base
        self.timeout = timeout
        self.force = force
        self.translate_names = translate_names
        self.translate_verification = translate_verification
        self.workers = workers
        self.cache_flush_every = cache_flush_every
        self.result_attempts = result_attempts
        self.progress_every = progress_every

        self.updated_fields = 0
        self.translated_new = 0
        self.cache_hit = 0
        self.failed_count = 0
        self.requirements_seen = 0
        self._pending_updates = 0
        self._attempted_non_cjk_cache: set[str] = set()

    def persist(self) -> None:
        save_json(self.zh_path, self.zh_data)
        save_json(self.cache_path, self.cache)

    def persist_cache_only(self) -> None:
        save_json(self.cache_path, self.cache)

    def maybe_persist(self) -> None:
        if self._pending_updates >= self.persist_every:
            self.persist()
            self._pending_updates = 0

    def framework_fields(self) -> List[str]:
        if self.translate_names:
            return ["name", "fullName", "description"]
        return ["description"]

    def node_fields(self) -> List[str]:
        if self.translate_names:
            return ["name", "description"]
        return ["description"]

    def requirement_fields(self) -> List[str]:
        fields = ["description"]
        if self.translate_names:
            fields.insert(0, "name")
        if self.translate_verification:
            fields.append("verification")
        return fields

    def collect_source_strings(self) -> List[str]:
        out: set[str] = set()

        def collect_from_node(node: Dict[str, Any], fields: List[str]) -> None:
            for field in fields:
                text = str(node.get(field, "")).strip()
                if should_translate_en_text(text):
                    out.add(text)

        def walk(nodes: List[Dict[str, Any]]) -> None:
            for node in nodes:
                collect_from_node(node, self.node_fields())
                reqs = node.get("requirements", [])
                if isinstance(reqs, list):
                    for req in reqs:
                        collect_from_node(req, self.requirement_fields())
                sub = node.get("subcategories", [])
                if isinstance(sub, list):
                    walk(sub)

        collect_from_node(self.en_data, self.framework_fields())
        categories = self.en_data.get("categories", [])
        if isinstance(categories, list):
            walk(categories)

        return sorted(out)

    def prefill_cache(self) -> None:
        all_strings = self.collect_source_strings()
        missing = []
        for text in all_strings:
            key = f"zh:{text}"
            cached = str(self.cache.get(key, "")).strip()
            if (not cached) or (not self.is_effective_translation(cached)):
                missing.append(text)
        print(
            f"[prefill] total_strings={len(all_strings)} missing={len(missing)} workers={self.workers}"
        )
        if not missing:
            return

        def worker(text: str) -> tuple[str, str, str | None]:
            try:
                translated = self.translate_effective_text(text)
                return (text, translated, None)
            except Exception as exc:  # noqa: BLE001
                return (text, "", str(exc))

        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = [pool.submit(worker, text) for text in missing]
            for future in concurrent.futures.as_completed(futures):
                source_text, translated_text, error = future.result()
                if error:
                    self.failed_count += 1
                    print(f"[warn] prefill failed, keep source text: {error}")
                else:
                    self.cache[f"zh:{source_text}"] = translated_text
                    self.translated_new += 1
                completed += 1

                if completed % self.cache_flush_every == 0 or completed == len(missing):
                    self.persist_cache_only()

                if completed % 50 == 0 or completed == len(missing):
                    print(
                        f"[prefill-progress] completed={completed}/{len(missing)} "
                        f"failed={self.failed_count}"
                    )

    def translate_text(self, source_text: str) -> str:
        key = f"zh:{source_text}"
        cached = str(self.cache.get(key, "")).strip()
        if cached and self.is_effective_translation(cached):
            self.cache_hit += 1
            return cached
        if cached and (key in self._attempted_non_cjk_cache):
            self.cache_hit += 1
            return cached
        try:
            translated = self.translate_effective_text(source_text)
        except Exception as exc:  # noqa: BLE001
            self.failed_count += 1
            print(f"[warn] translation failed, keep source text: {exc}")
            return source_text
        self.cache[key] = translated
        if not self.is_effective_translation(translated):
            self._attempted_non_cjk_cache.add(key)
        self.translated_new += 1
        return translated

    def is_effective_translation(self, text: str) -> bool:
        if not text:
            return False
        if CJK_RE.search(text):
            return True
        return not should_translate_en_text(text)

    def translate_effective_text(self, source_text: str) -> str:
        last: str = ""
        for _ in range(self.result_attempts):
            translated = translate_long_text(
                source_text,
                chunk_size=self.chunk_size,
                retries=self.retries,
                sleep_base=self.sleep_base,
                timeout=self.timeout,
            )
            last = translated
            if self.is_effective_translation(translated):
                return translated
            time.sleep(0.15)
        raise RuntimeError(f"non-cjk translation result: {last[:120]}")

    def translate_field(
        self,
        source_node: Dict[str, Any],
        target_node: Dict[str, Any],
        field: str,
        *,
        mark_requirement_language: bool = False,
    ) -> None:
        source_text = str(source_node.get(field, "")).strip()
        if not should_translate_en_text(source_text):
            return

        current_text = str(target_node.get(field, "")).strip()
        if (not self.force) and current_text and CJK_RE.search(current_text):
            return

        translated = self.translate_text(source_text)
        if current_text != translated:
            target_node[field] = translated
            if mark_requirement_language:
                target_node["contentLanguage"] = "zh"
            self.updated_fields += 1
            self._pending_updates += 1
            self.maybe_persist()

    def translate_common_fields(
        self,
        source_node: Dict[str, Any],
        target_node: Dict[str, Any],
        fields: List[str],
        *,
        requirement: bool = False,
    ) -> None:
        for field in fields:
            self.translate_field(
                source_node,
                target_node,
                field,
                mark_requirement_language=(requirement and field == "description"),
            )

    def translate_requirements(self, en_requirements: List[Dict[str, Any]], zh_requirements: List[Dict[str, Any]]) -> None:
        zh_map = {req_key(req, idx): req for idx, req in enumerate(zh_requirements)}
        requirement_fields = self.requirement_fields()
        for idx, en_req in enumerate(en_requirements):
            key = req_key(en_req, idx)
            zh_req = zh_map.get(key)
            if zh_req is None and idx < len(zh_requirements):
                zh_req = zh_requirements[idx]
            if zh_req is None:
                continue

            self.requirements_seen += 1
            self.translate_common_fields(
                en_req,
                zh_req,
                requirement_fields,
                requirement=True,
            )
            if self.progress_every > 0 and self.requirements_seen % self.progress_every == 0:
                print(
                    f"[progress] requirements={self.requirements_seen} "
                    f"updated_fields={self.updated_fields} "
                    f"translated_new={self.translated_new} cache_hit={self.cache_hit}"
                )

    def translate_category_tree(self, en_nodes: List[Dict[str, Any]], zh_nodes: List[Dict[str, Any]]) -> None:
        zh_by_id = {str(node.get("id", "")): node for node in zh_nodes}

        for idx, en_node in enumerate(en_nodes):
            en_id = str(en_node.get("id", ""))
            zh_node = zh_by_id.get(en_id)
            if zh_node is None and idx < len(zh_nodes):
                zh_node = zh_nodes[idx]
            if zh_node is None:
                continue

            node_fields = self.node_fields()
            self.translate_common_fields(en_node, zh_node, node_fields)

            en_reqs = en_node.get("requirements", [])
            zh_reqs = zh_node.get("requirements", [])
            if isinstance(en_reqs, list) and isinstance(zh_reqs, list):
                self.translate_requirements(en_reqs, zh_reqs)

            en_sub = en_node.get("subcategories", [])
            zh_sub = zh_node.get("subcategories", [])
            if isinstance(en_sub, list) and isinstance(zh_sub, list):
                self.translate_category_tree(en_sub, zh_sub)

    def run(self) -> None:
        self.prefill_cache()
        framework_fields = self.framework_fields()
        self.translate_common_fields(self.en_data, self.zh_data, framework_fields)
        en_categories = self.en_data.get("categories", [])
        zh_categories = self.zh_data.get("categories", [])
        if isinstance(en_categories, list) and isinstance(zh_categories, list):
            self.translate_category_tree(en_categories, zh_categories)
        self.zh_data["language"] = "zh"
        self.persist()
        print(
            f"done requirements={self.requirements_seen} updated_fields={self.updated_fields} "
            f"translated_new={self.translated_new} cache_hit={self.cache_hit} failed={self.failed_count}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate framework EN dataset into ZH dataset")
    parser.add_argument("--framework-id", required=True, help="Framework id (e.g. eu-gdpr)")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("public/data/frameworks"),
        help="Framework data directory",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=Path("scripts/frameworks/.framework-zh-translation-cache.json"),
        help="Translation cache path",
    )
    parser.add_argument("--persist-every", type=int, default=25, help="Persist every N updated fields")
    parser.add_argument("--progress-every", type=int, default=100, help="Print progress every N requirements")
    parser.add_argument("--workers", type=int, default=8, help="Concurrent translation workers for prefill")
    parser.add_argument(
        "--cache-flush-every",
        type=int,
        default=100,
        help="Persist cache every N translated strings during prefill",
    )
    parser.add_argument(
        "--result-attempts",
        type=int,
        default=3,
        help="How many times to retry when translation result is still non-CJK",
    )
    parser.add_argument("--chunk-size", type=int, default=1200, help="Translate chunk size")
    parser.add_argument("--retries", type=int, default=5, help="Retries per chunk")
    parser.add_argument("--timeout", type=int, default=15, help="HTTP timeout seconds")
    parser.add_argument("--retry-sleep-base", type=float, default=0.8, help="Retry backoff base seconds")
    parser.add_argument("--force", action="store_true", help="Overwrite already translated Chinese fields")
    parser.add_argument("--translate-names", action="store_true", help="Also translate name/fullName fields")
    parser.add_argument(
        "--translate-verification",
        action="store_true",
        help="Also translate requirement verification fields",
    )
    args = parser.parse_args()

    en_path = args.data_dir / f"{args.framework_id}-en.json"
    zh_path = args.data_dir / f"{args.framework_id}.json"

    if not en_path.exists():
        raise FileNotFoundError(f"Missing EN source: {en_path}")
    if not zh_path.exists():
        raise FileNotFoundError(f"Missing ZH target: {zh_path}")

    en_data = load_json(en_path)
    zh_data = load_json(zh_path)

    cache: Dict[str, str] = {}
    if args.cache.exists():
        loaded = load_json(args.cache)
        if isinstance(loaded, dict):
            cache = {str(k): str(v) for k, v in loaded.items()}

    translator = Translator(
        en_data=en_data,
        zh_data=zh_data,
        cache=cache,
        zh_path=zh_path,
        cache_path=args.cache,
        persist_every=max(1, args.persist_every),
        chunk_size=max(200, args.chunk_size),
        retries=max(1, args.retries),
        timeout=max(5, args.timeout),
        sleep_base=max(0.1, args.retry_sleep_base),
        force=bool(args.force),
        translate_names=bool(args.translate_names),
        translate_verification=bool(args.translate_verification),
        workers=max(1, args.workers),
        cache_flush_every=max(1, args.cache_flush_every),
        result_attempts=max(1, args.result_attempts),
        progress_every=max(0, args.progress_every),
    )
    translator.run()


if __name__ == "__main__":
    main()
