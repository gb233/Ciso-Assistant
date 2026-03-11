#!/usr/bin/env python3
"""Sync GDPR article descriptions from official EUR-Lex consolidated HTML text.

Usage:
  python3 scripts/frameworks/sync-gdpr-official-text.py \
    --html tmp/eurlex-gdpr-en.html \
    --target public/data/frameworks/eu-gdpr-en.json \
    --target public/data/frameworks/eu-gdpr.json \
    --content-language en
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict

from bs4 import BeautifulSoup

ARTICLE_CODE_PATTERN = re.compile(r"GDPR-ART-(\d{3})$")
ARTICLE_ID_PATTERN = re.compile(r"art_(\d+)$")


def normalize_text(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+\n", "\n", value)
    value = re.sub(r"\n\s+", "\n", value)
    value = re.sub(r"\n{2,}", "\n", value)
    return value.strip()


def extract_article_texts(html_file: Path) -> Dict[int, str]:
    soup = BeautifulSoup(html_file.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    articles: Dict[int, str] = {}

    for subdivision in soup.select('div.eli-subdivision[id^="art_"]'):
        subdivision_id = subdivision.get("id", "")
        match = ARTICLE_ID_PATTERN.fullmatch(subdivision_id)
        if not match:
            continue

        article_number = int(match.group(1))
        if article_number < 1 or article_number > 99:
            continue

        title_tag = subdivision.select_one("div.eli-title p.stitle-article-norm")
        title_text = normalize_text(title_tag.get_text(" ", strip=True)) if title_tag else ""

        # Clone the subtree and remove heading/title wrappers before extracting article body.
        clone = BeautifulSoup(str(subdivision), "html.parser")
        for selector in ["p.title-article-norm", "div.eli-title"]:
            for node in clone.select(selector):
                node.decompose()

        body_text = normalize_text(clone.get_text("\n", strip=True))
        if not body_text:
            continue

        if title_text:
            article_text = f"{title_text}\n{body_text}"
        else:
            article_text = body_text

        articles[article_number] = article_text

    return articles


def sync_framework_descriptions(
    framework_file: Path,
    article_texts: Dict[int, str],
    content_language: str,
) -> int:
    data = json.loads(framework_file.read_text(encoding="utf-8"))
    updated = 0

    for category in data.get("categories", []):
        for subcategory in category.get("subcategories", []):
            for requirement in subcategory.get("requirements", []):
                code = str(requirement.get("code", "")).strip()
                match = ARTICLE_CODE_PATTERN.fullmatch(code)
                if not match:
                    continue

                article_number = int(match.group(1))
                article_text = article_texts.get(article_number)
                if not article_text:
                    continue

                requirement["description"] = article_text
                requirement["contentLanguage"] = content_language
                updated += 1

    framework_file.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync GDPR article text from official EUR-Lex HTML.")
    parser.add_argument("--html", required=True, type=Path, help="Path to EUR-Lex GDPR consolidated EN HTML file")
    parser.add_argument(
        "--target",
        dest="targets",
        type=Path,
        action="append",
        required=True,
        help="Path to GDPR framework json file. Repeat this arg for multiple files.",
    )
    parser.add_argument(
        "--content-language",
        default="en",
        help="Language tag of synced article text (e.g., en, zh).",
    )
    args = parser.parse_args()

    article_texts = extract_article_texts(args.html)
    missing = [n for n in range(1, 100) if n not in article_texts]
    if missing:
        raise SystemExit(f"Missing extracted article texts: {missing}")

    content_language = args.content_language.strip().lower() or "en"

    print(f"Extracted {len(article_texts)} articles from {args.html}")
    for target in args.targets:
        updated = sync_framework_descriptions(target, article_texts, content_language)
        print(f"Updated {updated} requirements in {target} (contentLanguage={content_language})")


if __name__ == "__main__":
    main()
