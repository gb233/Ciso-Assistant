#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

from lxml import html as lxml_html
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE_URL = "https://sammy.codific.com"
_thread_local = threading.local()


def get_session(retries: int):
    if hasattr(_thread_local, "session"):
        return _thread_local.session

    retry = Retry(
        total=max(0, retries),
        connect=max(0, retries),
        read=max(0, retries),
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=32, pool_maxsize=32)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    _thread_local.session = session
    return session


def fetch_text(url: str, timeout_sec: int = 20, retries: int = 2) -> str:
    last_error = None
    for attempt in range(1, retries + 2):
        try:
            session = get_session(retries=retries)
            resp = session.get(url, timeout=(10, timeout_sec), allow_redirects=True)
            resp.raise_for_status()
            return resp.text
        except Exception as err:
            last_error = err
            if attempt < retries + 1:
                time.sleep(0.5 * attempt)
                continue
            # Last try with curl for TLS edge cases in this environment.
            try:
                curl = subprocess.run(
                    [
                        "curl",
                        "-fsSL",
                        "--retry",
                        "3",
                        "--retry-all-errors",
                        "--retry-delay",
                        "1",
                        "--connect-timeout",
                        "10",
                        "--max-time",
                        str(max(20, timeout_sec + 10)),
                        url,
                    ],
                    capture_output=True,
                    check=True,
                    text=True,
                )
                return curl.stdout
            except Exception as curl_err:
                raise RuntimeError(f"Failed to fetch {url}: {last_error}; curl_fallback={curl_err}") from err
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def slug_to_title(slug: str) -> str:
    parts = [p for p in slug.split("-") if p]
    if not parts:
        return slug
    out = []
    for part in parts:
        if part.isupper():
            out.append(part)
        elif part.isdigit():
            out.append(part)
        else:
            out.append(part.capitalize())
    return " ".join(out)


def extract_slug_from_url(url: str) -> Optional[str]:
    path = urlparse(url).path
    m = re.match(r"^/browse/([^/]+)", path)
    return m.group(1) if m else None


def extract_paths_from_html(slug: str, page_html: str) -> Set[str]:
    # Collect all /browse/{slug}/... links and normalize to local tail paths.
    pattern = re.compile(rf"href=['\"](/browse/{re.escape(slug)}/[^'\"?#]+)['\"]")
    paths: Set[str] = set()
    for m in pattern.finditer(page_html):
        path = m.group(1)
        parts = [p for p in path.split("/") if p]
        # Expect ["browse", slug, ...] with at least category/subcategory.
        if len(parts) < 4:
            continue
        if parts[0] != "browse" or parts[1] != slug:
            continue
        local_path = "/".join(parts[2:])
        if len(local_path.split("/")) < 2:
            continue
        paths.add(local_path)
    return paths


def collect_nav_names(
    slug: str,
    page_html: str,
    category_names: Dict[str, str],
    subcategory_names: Dict[str, str],
) -> None:
    # Read left-nav labels to keep stable human names for category/subcategory.
    doc = lxml_html.fromstring(page_html)
    side_links = doc.xpath(f"//a[contains(@href, '/browse/{slug}/')]")
    for node in side_links:
        href = node.get("href", "")
        m = re.search(rf"/browse/{re.escape(slug)}/([^\"'#?]+)", href)
        if not m:
            continue
        tail = m.group(1).strip("/")
        parts = [p for p in tail.split("/") if p]
        if len(parts) < 2:
            continue

        cat_slug = parts[0]
        sub_slug = parts[1]

        title_attr = normalize_text(node.get("title"))
        text = normalize_text(" ".join(node.xpath(".//text()")))
        label = title_attr or text
        if not label:
            continue

        category_names.setdefault(cat_slug, slug_to_title(cat_slug))
        subcategory_names.setdefault(f"{cat_slug}/{sub_slug}", label)


def list_framework_paths(
    slug: str,
    landing_html: str,
    timeout_sec: int = 20,
    retries: int = 2,
    concurrency: int = 8,
    probe_pages: int = 5,
) -> Tuple[int, List[str], Dict[str, str], Dict[str, str]]:
    paths = extract_paths_from_html(slug, landing_html)
    if not paths:
        return 0, [], {}, {}

    category_names: Dict[str, str] = {}
    subcategory_names: Dict[str, str] = {}
    collect_nav_names(slug, landing_html, category_names, subcategory_names)

    fetched_discovery_pages: Set[str] = set()
    discovery_mode = "probe"
    any_deeper_discovered = False
    max_probe_pages = max(1, probe_pages)

    def unresolved_depth2_paths() -> List[str]:
        depth2 = sorted(p for p in paths if len(p.split("/")) == 2)
        out: List[str] = []
        for p in depth2:
            if p in fetched_discovery_pages:
                continue
            prefix = f"{p}/"
            if any(other != p and other.startswith(prefix) for other in paths):
                continue
            out.append(p)
        return out

    while True:
        unresolved = unresolved_depth2_paths()
        if not unresolved:
            break

        batch = unresolved if discovery_mode == "full" else unresolved[:max_probe_pages]
        fetch_jobs = []
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
            future_to_path = {
                pool.submit(
                    fetch_text,
                    urljoin(BASE_URL, f"/browse/{slug}/{path}"),
                    max(5, timeout_sec),
                    max(0, retries),
                ): path
                for path in batch
            }
            for fut in as_completed(future_to_path):
                path = future_to_path[fut]
                page_html = fut.result()
                fetch_jobs.append((path, page_html))

        discovered_in_batch = False
        for path, page_html in fetch_jobs:
            fetched_discovery_pages.add(path)
            collect_nav_names(slug, page_html, category_names, subcategory_names)
            discovered = extract_paths_from_html(slug, page_html)
            if any(len(local.split("/")) > 2 for local in discovered):
                discovered_in_batch = True
            paths.update(discovered)

        if discovery_mode == "probe":
            if discovered_in_batch:
                discovery_mode = "full"
                any_deeper_discovered = True
                continue
            # No deeper links found in probes: avoid doubling fetches for large
            # depth-2-only frameworks (e.g., NIST 800-53).
            break

        if discovered_in_batch:
            any_deeper_discovered = True

    depth_values = [len(p.split("/")) for p in paths]
    max_depth = max(depth_values) if depth_values else 0

    # Keep only leaf paths (a path without deeper descendants).
    # This supports mixed-depth frameworks where valid requirement pages exist at
    # both depth-2 and depth-3 under the same slug.
    candidate_paths = []
    for path in sorted(paths):
        prefix = f"{path}/"
        if any(other != path and other.startswith(prefix) for other in paths):
            continue
        candidate_paths.append(path)

    # If we did discover deeper links, never treat probed depth-2 pages that now
    # have descendants as leaves.
    if any_deeper_discovered:
        candidate_paths = [
            p
            for p in candidate_paths
            if not any(other != p and other.startswith(f"{p}/") for other in paths)
        ]

    return max_depth, candidate_paths, category_names, subcategory_names


def parse_requirement_from_question(
    framework_id: str,
    page_code_hint: str,
    page_title: str,
    page_desc: str,
    question_node,
    sequence: int,
) -> Dict:
    qid = question_node.get("data-question", "").strip()
    question_text = normalize_text(
        " ".join(
            question_node.xpath(
                ".//div[contains(@class, 'font-bold')]//text() | .//div[contains(@class, 'font-semibold')]//text()"
            )
        )
    )
    if not question_text:
        question_text = normalize_text(" ".join(question_node.xpath(".//text()")))

    code = page_code_hint
    name = page_title or f"Requirement {sequence}"
    m = re.match(r"^([A-Za-z0-9._-]+)\s*:\s*(.+)$", question_text)
    if m:
        code = m.group(1).strip()
        name = m.group(2).strip()
    elif question_text:
        name = question_text
        if qid:
            # Keep code unique per question when page does not expose explicit control code.
            code = f"{page_code_hint}.{qid}"
    elif qid:
        code = f"{page_code_hint}.{qid}"

    # Pull quality criteria bullets as extra detail if present.
    bullets = [
        normalize_text(" ".join(li.xpath(".//text()")))
        for li in question_node.xpath(".//ul/li")
    ]
    bullets = [b for b in bullets if b]

    description_parts = []
    if page_desc:
        description_parts.append(page_desc)
    if bullets:
        description_parts.append("Criteria: " + " | ".join(bullets))
    description = "\n\n".join(description_parts) if description_parts else name

    # Infer maturity level upper bound from answer options on same page.
    answer_texts = []
    for btn in question_node.xpath(".//button[starts-with(@id, 'answer-')]"):
        text = normalize_text(" ".join(btn.xpath(".//text()")))
        if text:
            answer_texts.append(text)
    # Preserve order while de-duplicating repeated options.
    answer_texts = list(dict.fromkeys(answer_texts))
    level_candidates = []
    for txt in answer_texts:
        m_lvl = re.search(r"[Ll]evel\\s+(\\d+)", txt)
        if m_lvl:
            level_candidates.append(int(m_lvl.group(1)))
    level = str(max(level_candidates)) if level_candidates else "1"

    req_id_seed = code.lower().replace(".", "-").replace("_", "-")
    req_id_seed = re.sub(r"[^a-z0-9-]+", "-", req_id_seed).strip("-")
    if not req_id_seed:
        req_id_seed = f"{framework_id}-req-{sequence}"
    if qid:
        req_id_seed = f"{req_id_seed}-{qid}"

    return {
        "id": req_id_seed,
        "code": code,
        "name": name,
        "description": description,
        "questionType": "control",
        "level": level,
        "verification": "Review requirement evidence and assessment responses.",
        "_answer_options": answer_texts,
        "_question_id": qid,
    }


def parse_page(
    framework_id: str,
    slug: str,
    local_path: str,
    page_html: str,
    seq_start: int,
) -> Tuple[List[Dict], Dict]:
    doc = lxml_html.fromstring(page_html)
    segments = local_path.split("/")
    cat_slug = segments[0]
    sub_slug = segments[1]
    page_tail = segments[2] if len(segments) > 2 else ""

    # Prefer tab text (often includes code prefix like "SI.PS: Purpose and Scope").
    tab_text = normalize_text(" ".join(doc.xpath("//a[@role='tab' and contains(@class, 'tab-active')]//text()")))
    if not tab_text:
        tab_text = normalize_text(" ".join(doc.xpath("//a[@role='tab'][1]//text()")))
    page_title = normalize_text(" ".join(doc.xpath("//div[contains(@class, 'text-xl') and contains(@class, 'break-words')][1]//text()")))
    if not page_title and tab_text:
        page_title = tab_text.split(":", 1)[-1].strip()
    if not page_title:
        page_title = slug_to_title(page_tail or sub_slug)

    page_code_hint = slug_to_title(page_tail or sub_slug).replace(" ", ".").upper()
    m_code = re.match(r"^([A-Za-z0-9._-]+)\s*:", tab_text)
    if m_code:
        page_code_hint = m_code.group(1).strip()

    desc_parts = [
        normalize_text(" ".join(node.xpath(".//text()")))
        for node in doc.xpath("//h5[normalize-space()='Description']/ancestor::details[1]//div[contains(@class, 'collapse-content')]")
    ]
    desc_parts = [p for p in desc_parts if p]
    page_desc = "\n\n".join(desc_parts)

    # Keep only the outer question containers. Some pages also include a second
    # inner node (e.g., right-side assessment answer column) with the same
    # data-question id, which should not be parsed as a separate control.
    question_nodes = doc.xpath(
        "//*[@data-question and .//div[contains(@class, 'font-bold') or contains(@class, 'font-semibold')]]"
    )
    requirements: List[Dict] = []
    seq = seq_start

    if question_nodes:
        for q_node in question_nodes:
            seq += 1
            requirement = parse_requirement_from_question(
                framework_id=framework_id,
                page_code_hint=page_code_hint,
                page_title=page_title,
                page_desc=page_desc,
                question_node=q_node,
                sequence=seq,
            )
            answer_options = requirement.pop("_answer_options", [])
            question_id = requirement.pop("_question_id", "")
            requirements.append(requirement)

            # Represent maturity/rating scales as rubric rows linked to the
            # parent control, instead of polluting control rows.
            if len(answer_options) >= 2:
                seq += 1
                options_text = " | ".join(answer_options)
                qid_suffix = question_id or str(seq)
                requirements.append(
                    {
                        "id": f"{requirement['id']}-rubric-{qid_suffix}",
                        "code": f"{requirement['code']}.R{qid_suffix}",
                        "name": options_text,
                        "description": f"Assessment options: {options_text}",
                        "questionType": "rubric",
                        "parentControlCode": requirement["code"],
                        "level": requirement.get("level", "1"),
                        "verification": "Review requirement evidence and assessment responses.",
                    }
                )
    else:
        seq += 1
        code = page_code_hint
        req_id = re.sub(r"[^a-z0-9-]+", "-", code.lower().replace(".", "-")).strip("-")
        if not req_id:
            req_id = f"{framework_id}-req-{seq}"
        requirements.append(
            {
                "id": req_id,
                "code": code,
                "name": page_title,
                "description": page_desc or page_title,
                "questionType": "control",
                "level": "1",
                "verification": "Review requirement evidence and assessment responses.",
            }
        )

    page_info = {
        "category_slug": cat_slug,
        "subcategory_slug": sub_slug,
        "page_tail": page_tail,
        "page_title": page_title,
        "page_desc": page_desc,
        "requirements": requirements,
        "sequence_end": seq,
    }
    return requirements, page_info


def build_framework_json(
    framework_id: str,
    slug: str,
    source_url: str,
    template: Dict,
    category_names: Dict[str, str],
    subcategory_names: Dict[str, str],
    page_infos: List[Dict],
) -> Dict:
    categories: Dict[str, Dict] = {}
    req_id_seen: Dict[str, int] = {}
    req_code_seen: Dict[str, int] = {}

    for page in page_infos:
        cat_slug = page["category_slug"]
        sub_slug = page["subcategory_slug"]
        sub_key = f"{cat_slug}/{sub_slug}"

        if cat_slug not in categories:
            categories[cat_slug] = {
                "id": cat_slug,
                "code": cat_slug.upper().replace("-", "_"),
                "name": category_names.get(cat_slug, slug_to_title(cat_slug)),
                "description": f"{slug_to_title(cat_slug)} requirements.",
                "requirements": 0,
                "subcategories": {},
            }

        cat = categories[cat_slug]
        if sub_key not in cat["subcategories"]:
            cat["subcategories"][sub_key] = {
                "id": sub_slug,
                "code": sub_slug.upper().replace("-", "_"),
                "name": subcategory_names.get(sub_key, slug_to_title(sub_slug)),
                "description": page["page_desc"] or f"{slug_to_title(sub_slug)} requirements.",
                "requirements": [],
                "rubrics": [],
            }

        sub = cat["subcategories"][sub_key]
        for req in page["requirements"]:
            req_id = req.get("id", "")
            req_code = req.get("code", "")

            if req_id:
                req_id_seen[req_id] = req_id_seen.get(req_id, 0) + 1
                if req_id_seen[req_id] > 1:
                    req["id"] = f"{req_id}-{req_id_seen[req_id]}"

            if req_code:
                req_code_seen[req_code] = req_code_seen.get(req_code, 0) + 1
                if req_code_seen[req_code] > 1:
                    req["code"] = f"{req_code}.{req_code_seen[req_code]}"

            if req.get("questionType") == "rubric":
                sub["rubrics"].append(req)
            else:
                sub["requirements"].append(req)

    category_list = []
    total_subcategories = 0
    total_requirements = 0
    total_rubrics = 0
    level_counts: Dict[str, int] = {}

    for cat_slug in sorted(categories.keys()):
        cat = categories[cat_slug]
        sub_list = []
        cat_req_count = 0
        for sub_key in sorted(cat["subcategories"].keys()):
            sub = cat["subcategories"][sub_key]
            sub_reqs = sub["requirements"]
            sub_rubrics = sub["rubrics"]
            cat_req_count += len(sub_reqs)
            total_requirements += len(sub_reqs)
            total_rubrics += len(sub_rubrics)
            total_subcategories += 1
            for req in sub_reqs:
                lvl = str(req.get("level", "1"))
                level_counts[lvl] = level_counts.get(lvl, 0) + 1
            sub_list.append(
                {
                    "id": sub["id"],
                    "code": sub["code"],
                    "name": sub["name"],
                    "description": sub["description"],
                    "requirements": sub_reqs,
                    "rubrics": sub_rubrics,
                }
            )

        category_list.append(
            {
                "id": cat["id"],
                "code": cat["code"],
                "name": cat["name"],
                "description": cat["description"],
                "requirements": cat_req_count,
                "subcategories": sub_list,
            }
        )

    today = date.today().isoformat()
    out = dict(template)
    out["id"] = framework_id
    out["language"] = "en"
    out["lastUpdated"] = today
    out["source"] = {
        "type": "sammy-browse-snapshot",
        "url": source_url,
        "slug": slug,
        "snapshotDate": today,
    }
    out["stats"] = {
        "totalRequirements": total_requirements,
        "totalRubrics": total_rubrics,
        "totalCategories": len(category_list),
        "totalSubcategories": total_subcategories,
        "level1": level_counts.get("1", 0),
        "level2": level_counts.get("2", 0),
        "level3": level_counts.get("3", 0),
    }
    out["categories"] = category_list
    return out


def default_template(framework_id: str) -> Dict:
    return {
        "id": framework_id,
        "name": framework_id,
        "fullName": framework_id,
        "version": "unknown",
        "type": "standard",
        "domain": "cybersecurity",
        "description": f"{framework_id} requirements pulled from Sammy.",
        "website": "https://sammy.codific.com",
        "organization": "Codific Sammy",
        "releaseDate": date.today().isoformat(),
        "lastUpdated": date.today().isoformat(),
        "language": "en",
        "stats": {"totalRequirements": 0, "level1": 0, "level2": 0, "level3": 0},
        "categories": [],
    }


def main():
    parser = argparse.ArgumentParser(description="Pull one framework from Sammy browse pages.")
    parser.add_argument("--framework", required=True, help="Local framework id, e.g., nist-800-53")
    parser.add_argument("--slug", required=True, help="Sammy slug, e.g., nist-800-53-v5")
    parser.add_argument("--output", default=None, help="Output english json path")
    parser.add_argument("--concurrency", type=int, default=8, help="Concurrent page fetches")
    parser.add_argument("--max-pages", type=int, default=0, help="Optional limit for debugging")
    parser.add_argument("--timeout", type=int, default=20, help="Read timeout per request in seconds")
    parser.add_argument("--retries", type=int, default=2, help="Retry count per request")
    parser.add_argument(
        "--report",
        default=None,
        help="Output pull report path",
    )
    args = parser.parse_args()

    framework_id = args.framework
    slug = args.slug
    source_url = f"{BASE_URL}/browse/{slug}"

    output_path = Path(args.output or f"public/data/frameworks/{framework_id}-en.json")
    report_path = Path(args.report or f"docs/framework-checkpoints/{framework_id}-pull-report.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    template = default_template(framework_id)
    if output_path.exists():
        template = json.loads(output_path.read_text(encoding="utf-8"))

    landing_html = fetch_text(source_url, timeout_sec=max(5, args.timeout), retries=max(0, args.retries))
    landing_final_slug = extract_slug_from_url(source_url)
    if landing_final_slug != slug and landing_final_slug and landing_final_slug != slug:
        # Keep requested slug for extraction regex; route may redirect downstream to first requirement page.
        pass

    depth, local_paths, category_names, subcategory_names = list_framework_paths(
        slug=slug,
        landing_html=landing_html,
        timeout_sec=max(5, args.timeout),
        retries=max(0, args.retries),
        concurrency=max(1, args.concurrency),
    )
    if not local_paths:
        raise RuntimeError(
            f"No framework paths found for slug '{slug}'. "
            f"Likely not publicly accessible or slug is invalid."
        )

    if args.max_pages and args.max_pages > 0:
        local_paths = local_paths[: args.max_pages]

    page_results: List[Tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futures = {
            pool.submit(
                fetch_text,
                urljoin(BASE_URL, f"/browse/{slug}/{path}"),
                max(5, args.timeout),
                max(0, args.retries),
            ): path
            for path in local_paths
        }
        for fut in as_completed(futures):
            path = futures[fut]
            page_html = fut.result()
            page_results.append((path, page_html))

    page_results.sort(key=lambda x: x[0])
    seq = 0
    page_infos = []
    for path, page_html in page_results:
        _, page_info = parse_page(
            framework_id=framework_id,
            slug=slug,
            local_path=path,
            page_html=page_html,
            seq_start=seq,
        )
        seq = page_info["sequence_end"]
        page_infos.append(page_info)

    framework_json = build_framework_json(
        framework_id=framework_id,
        slug=slug,
        source_url=source_url,
        template=template,
        category_names=category_names,
        subcategory_names=subcategory_names,
        page_infos=page_infos,
    )
    output_path.write_text(
        json.dumps(framework_json, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Build report.
    total_subs = sum(len(c["subcategories"]) for c in framework_json["categories"])
    total_reqs = sum(
        len(s["requirements"])
        for c in framework_json["categories"]
        for s in c["subcategories"]
    )
    report = {
        "frameworkId": framework_id,
        "slug": slug,
        "sourceUrl": source_url,
        "depth": depth,
        "pagesFetched": len(page_results),
        "categories": len(framework_json["categories"]),
        "subcategories": total_subs,
        "requirements": total_reqs,
        "output": str(output_path),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Pulled {framework_id} from Sammy slug={slug}: "
        f"pages={report['pagesFetched']} categories={report['categories']} "
        f"subcategories={report['subcategories']} requirements={report['requirements']}"
    )
    print(f"Output: {output_path}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
