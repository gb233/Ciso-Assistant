#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
from datetime import date
from pathlib import Path

from pypdf import PdfReader

NIST_800_171R2_PDF = "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-171r2.pdf"
CMMC_DOCS_URL = "https://dodcio.defense.gov/CMMC/Documentation/"

# CMMC 2.0 Level 1 (Foundational) requirements are a subset of 800-171r2 controls.
# Codes are represented in NIST format here (3.x.y).
L1_CODES = {
    "3.1.1",
    "3.1.2",
    "3.1.20",
    "3.1.22",
    "3.5.1",
    "3.5.2",
    "3.8.3",
    "3.10.1",
    "3.10.3",
    "3.10.4",
    "3.10.5",
    "3.13.1",
    "3.13.5",
    "3.13.8",
    "3.14.1",
    "3.14.2",
    "3.14.4",
}

FAMILY_MAP = {
    1: ("access-control", "3.1", "Access Control"),
    2: ("awareness-and-training", "3.2", "Awareness and Training"),
    3: ("audit-and-accountability", "3.3", "Audit and Accountability"),
    4: ("configuration-management", "3.4", "Configuration Management"),
    5: ("identification-and-authentication", "3.5", "Identification and Authentication"),
    6: ("incident-response", "3.6", "Incident Response"),
    7: ("maintenance", "3.7", "Maintenance"),
    8: ("media-protection", "3.8", "Media Protection"),
    9: ("personnel-security", "3.9", "Personnel Security"),
    10: ("physical-protection", "3.10", "Physical Protection"),
    11: ("risk-assessment", "3.11", "Risk Assessment"),
    12: ("security-assessment", "3.12", "Security Assessment"),
    13: ("system-and-communications-protection", "3.13", "System and Communications Protection"),
    14: ("system-and-information-integrity", "3.14", "System and Information Integrity"),
}

REQ_LINE_RE = re.compile(r"^(3\.(\d+)\.(\d+))\s+(.*)$")


def fetch_pdf(url: str, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
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
            "-A",
            "Mozilla/5.0",
            "-o",
            str(output_path),
            url,
        ],
        check=True,
    )


def normalize_line(value: str):
    return re.sub(r"\s+", " ", value).strip()


def parse_800_171_requirements(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    lines = []
    for page in reader.pages:
        text = page.extract_text() or ""
        for raw in text.splitlines():
            line = normalize_line(raw)
            if line:
                lines.append(line)

    parsed = []
    current = None
    for line in lines:
        match = REQ_LINE_RE.match(line)
        if match:
            code = match.group(1)
            family_num = int(match.group(2))
            title_start = match.group(4).strip()
            if family_num < 1 or family_num > 14:
                current = None
                continue

            current = {
                "code": code,
                "family": family_num,
                "parts": [title_start],
                "done": "." in title_start,
            }
            parsed.append(current)
            continue

        if current is None:
            continue
        if current["done"]:
            continue

        lower = line.lower()
        if lower.startswith("discussion") or lower.startswith("assessment objectives"):
            current["done"] = True
            continue
        if re.match(r"^[0-9]+$", line):
            continue
        if "NIST SP 800-171" in line:
            continue

        current["parts"].append(line)
        joined = " ".join(current["parts"])
        if "." in joined:
            current["done"] = True

    # Keep first occurrence of each requirement code to avoid appendix duplicates.
    unique = {}
    for row in parsed:
        code = row["code"]
        if code in unique:
            continue
        joined = " ".join(row["parts"]).strip()
        joined = re.split(r"\b(DISCUSSION|Discussion|ASSESSMENT OBJECTIVES|Assessment Objectives)\b", joined)[0].strip()
        if "." in joined:
            joined = joined.split(".", 1)[0].strip() + "."
        unique[code] = {
            "code": code,
            "family": row["family"],
            "statement": joined,
        }

    requirements = [unique[key] for key in sorted(unique.keys(), key=lambda x: [int(part) for part in x.split(".")])]
    return requirements


def requirement_to_json(req):
    code = req["code"]
    family_num = req["family"]
    level = "1" if code in L1_CODES else "2"
    return {
        "id": code.replace(".", "-"),
        "code": code,
        "name": req["statement"],
        "description": req["statement"],
        "level": level,
        "verification": "Review CMMC assessment evidence for this requirement.",
        "nist": code,
    }, family_num, level


def build_framework(requirements):
    categories = []
    level1_count = 0
    level2_count = 0
    total_requirements = 0
    today = date.today().isoformat()

    for family_num in sorted(FAMILY_MAP.keys()):
        family_id, family_code, family_name = FAMILY_MAP[family_num]
        family_reqs = [r for r in requirements if r["family"] == family_num]
        req_json = []
        for req in family_reqs:
            item, _, level = requirement_to_json(req)
            req_json.append(item)
            if level == "1":
                level1_count += 1
            else:
                level2_count += 1

        total_requirements += len(req_json)
        categories.append(
            {
                "id": family_id,
                "code": family_code,
                "name": family_name,
                "description": f"CMMC requirements mapped to NIST 800-171r2 {family_name} family.",
                "requirements": len(req_json),
                "subcategories": [
                    {
                        "id": f"{family_id}-requirements",
                        "code": family_code,
                        "name": family_name,
                        "description": "CMMC Level 1/2 requirements in this family.",
                        "requirements": req_json,
                    }
                ],
            }
        )

    return {
        "id": "cmmc-l1-l2",
        "name": "CMMC",
        "fullName": "Cybersecurity Maturity Model Certification (Levels 1 and 2)",
        "version": "2.0",
        "type": "maturity-model",
        "domain": "defense",
        "description": (
            "CMMC Levels 1 and 2 extracted from official NIST SP 800-171r2 control statements, "
            "with Level 1 subset tagging aligned to CMMC 2.0 foundational scope."
        ),
        "website": CMMC_DOCS_URL,
        "organization": "DoD CIO / NIST",
        "releaseDate": "2021-11-01",
        "lastUpdated": today,
        "language": "en",
        "source": {
            "type": "official-machine-readable-derivative",
            "primaryUrl": NIST_800_171R2_PDF,
            "programUrl": CMMC_DOCS_URL,
        },
        "stats": {
            "totalRequirements": total_requirements,
            "totalCategories": len(categories),
            "totalSubcategories": len(categories),
            "level1": level1_count,
            "level2": level2_count,
            "level3": 0,
        },
        "categories": categories,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Pull CMMC Levels 1/2 from official NIST SP 800-171r2 source."
    )
    parser.add_argument("--source-url", default=NIST_800_171R2_PDF)
    parser.add_argument(
        "--output",
        default="public/data/frameworks/cmmc-l1-l2-en.json",
        help="Path to output English framework JSON.",
    )
    parser.add_argument(
        "--report",
        default="docs/framework-checkpoints/cmmc-l1-l2-pull-report.json",
        help="Path to write pull report summary JSON.",
    )
    args = parser.parse_args()

    pdf_path = Path("/tmp/cmmc-nist-800-171r2.pdf")
    fetch_pdf(args.source_url, pdf_path)
    requirements = parse_800_171_requirements(pdf_path)
    if len(requirements) < 100:
        raise RuntimeError(f"Extracted too few requirements from source ({len(requirements)}).")

    framework = build_framework(requirements)
    if framework["stats"]["totalRequirements"] != 110:
        raise RuntimeError(
            f"Unexpected CMMC requirement count: {framework['stats']['totalRequirements']} (expected 110)."
        )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(framework, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    report = {
        "frameworkId": framework["id"],
        "sourceUrl": args.source_url,
        "sourceProgramUrl": CMMC_DOCS_URL,
        "categories": framework["stats"]["totalCategories"],
        "subcategories": framework["stats"]["totalSubcategories"],
        "requirements": framework["stats"]["totalRequirements"],
        "level1": framework["stats"]["level1"],
        "level2": framework["stats"]["level2"],
        "output": str(output_path),
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Pulled cmmc-l1-l2: categories={report['categories']} "
        f"subcategories={report['subcategories']} requirements={report['requirements']} "
        f"level1={report['level1']} level2={report['level2']}"
    )
    print(f"Output: {report['output']}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
