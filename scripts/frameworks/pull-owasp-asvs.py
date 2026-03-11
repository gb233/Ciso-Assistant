#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

DEFAULT_SOURCE_URL = (
    "https://github.com/OWASP/ASVS/releases/download/v4.0.3_release/"
    "OWASP.Application.Security.Verification.Standard.4.0.3-en.json"
)


def fetch_json(source_url: str):
    payload = None
    try:
        req = Request(source_url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=60) as response:
            payload = response.read()
    except Exception:
        result = subprocess.run(
            [
                "curl",
                "-fsSL",
                "--retry",
                "5",
                "--retry-all-errors",
                "--retry-delay",
                "2",
                "--connect-timeout",
                "20",
                "--max-time",
                "180",
                source_url,
            ],
            check=True,
            capture_output=True,
        )
        payload = result.stdout

    if not payload:
        raise RuntimeError("Downloaded ASVS JSON is empty.")

    return json.loads(payload.decode("utf-8"))


def normalize_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def remove_markdown_links(text: str):
    # [label](url) -> label
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)


def infer_requirement_name(description: str, code: str):
    text = normalize_text(remove_markdown_links(description))
    if not text:
        return code
    if text.lower().startswith("verify that "):
        text = text[12:]
        text = text[:1].upper() + text[1:]
    sentence = text.split(".")[0].strip()
    return sentence if sentence else text[:120]


def infer_level(item):
    l3 = bool(item.get("L3", {}).get("Required"))
    l2 = bool(item.get("L2", {}).get("Required"))
    l1 = bool(item.get("L1", {}).get("Required"))
    if l1:
        return "1"
    if l2:
        return "2"
    if l3:
        return "3"
    return "1"


def build_verification(item):
    references = []
    cwes = item.get("CWE") or []
    nists = item.get("NIST") or []
    if cwes:
        references.append("CWE: " + ", ".join(str(v) for v in cwes))
    if nists:
        references.append("NIST: " + ", ".join(str(v) for v in nists))
    return " | ".join(references) if references else "Review ASVS evidence and test results."


def build_framework(raw, source_url):
    categories = []
    level_counts = {"1": 0, "2": 0, "3": 0}

    for cat in raw.get("Requirements", []):
        cat_code = normalize_text(cat.get("Shortcode"))
        cat_name = normalize_text(cat.get("ShortName")) or cat_code
        cat_desc = normalize_text(cat.get("Name")) or f"{cat_name} requirements."
        subcategories = []
        cat_req_count = 0

        for sub in cat.get("Items") or []:
            sub_code = normalize_text(sub.get("Shortcode"))
            sub_name = normalize_text(sub.get("Name")) or sub_code
            sub_desc = f"{sub_name} requirements."
            requirements = []

            for item in sub.get("Items") or []:
                req_code = normalize_text(item.get("Shortcode"))
                req_description = normalize_text(remove_markdown_links(item.get("Description")))
                req_level = infer_level(item)
                req_name = infer_requirement_name(req_description, req_code)

                requirements.append(
                    {
                        "id": req_code.lower().replace(".", "-"),
                        "code": req_code,
                        "name": req_name,
                        "description": req_description,
                        "level": req_level,
                        "verification": build_verification(item),
                    }
                )
                level_counts[req_level] += 1

            cat_req_count += len(requirements)
            subcategories.append(
                {
                    "id": sub_code.lower().replace(".", "-"),
                    "code": sub_code,
                    "name": sub_name,
                    "description": sub_desc,
                    "requirements": requirements,
                }
            )

        categories.append(
            {
                "id": cat_code.lower().replace(".", "-"),
                "code": cat_code,
                "name": cat_name,
                "description": cat_desc,
                "requirements": cat_req_count,
                "subcategories": subcategories,
            }
        )

    total_subcategories = sum(len(c["subcategories"]) for c in categories)
    total_requirements = sum(
        len(sub["requirements"])
        for category in categories
        for sub in category["subcategories"]
    )

    today = date.today().isoformat()
    return {
        "id": "owasp-asvs",
        "name": "OWASP ASVS",
        "fullName": "OWASP Application Security Verification Standard",
        "version": raw.get("Version", "4.0.3"),
        "type": "standard",
        "domain": "application-security",
        "description": normalize_text(raw.get("Description"))
        or "OWASP Application Security Verification Standard.",
        "website": "https://owasp.org/www-project-application-security-verification-standard/",
        "organization": "OWASP",
        "releaseDate": "2021-10-28",
        "lastUpdated": today,
        "language": "en",
        "source": {
            "type": "official-machine-readable",
            "url": source_url,
        },
        "stats": {
            "totalRequirements": total_requirements,
            "totalCategories": len(categories),
            "totalSubcategories": total_subcategories,
            "level1": level_counts["1"],
            "level2": level_counts["2"],
            "level3": level_counts["3"],
        },
        "categories": categories,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Pull OWASP ASVS from official OWASP JSON release."
    )
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument(
        "--output",
        default="public/data/frameworks/owasp-asvs-en.json",
        help="Path to output English framework JSON.",
    )
    parser.add_argument(
        "--report",
        default="docs/framework-checkpoints/owasp-asvs-pull-report.json",
        help="Path to write pull report summary JSON.",
    )
    args = parser.parse_args()

    raw = fetch_json(args.source_url)
    framework = build_framework(raw, args.source_url)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(framework, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    report = {
        "frameworkId": framework["id"],
        "sourceUrl": args.source_url,
        "categories": framework["stats"]["totalCategories"],
        "subcategories": framework["stats"]["totalSubcategories"],
        "requirements": framework["stats"]["totalRequirements"],
        "output": str(output_path),
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Pulled owasp-asvs: categories={report['categories']} "
        f"subcategories={report['subcategories']} requirements={report['requirements']}"
    )
    print(f"Output: {report['output']}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
