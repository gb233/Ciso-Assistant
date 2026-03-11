#!/usr/bin/env python3

import argparse
import json
import subprocess
from datetime import date
from pathlib import Path


SAMMY_MAPPINGS = {
    "owasp-samm": "samm",
    "nist-csf-2.0": "nist-csf-20",
    "nist-800-53": "nist-800-53-v5",
    "nist-800-34": "nist-800-34",
    "nist-800-171": "nist-800-171-rev-3",
    "cis-csc-v8": "cis-critical-security-controls",
    "cyberfundamentals-20": "cybersecurity-fundamentals-20",
    "dsomm": "dsomm",
    "bsimm-15": "bsimm-15",
    "nis2": "nis2",
    "aima": "aima",
    "secure-controls-framework": "secure-controls-framework",
    "cloud-controls-matrix": "cloud-controls-matrix",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def count_hierarchy(framework):
    categories = framework.get("categories") or []
    subcategories = 0
    requirements = 0
    for cat in categories:
        subs = cat.get("subcategories") or []
        subcategories += len(subs)
        for sub in subs:
            requirements += len(sub.get("requirements") or [])
    return len(categories), subcategories, requirements


def run_pull(
    framework_id: str,
    slug: str,
    concurrency: int,
    max_pages: int,
    timeout: int,
    retries: int,
):
    cmd = [
        "python3",
        "scripts/frameworks/pull-sammy-framework.py",
        "--framework",
        framework_id,
        "--slug",
        slug,
        "--concurrency",
        str(concurrency),
        "--timeout",
        str(timeout),
        "--retries",
        str(retries),
    ]
    if max_pages > 0:
        cmd += ["--max-pages", str(max_pages)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "ok": proc.returncode == 0,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
        "returncode": proc.returncode,
    }


def main():
    parser = argparse.ArgumentParser(description="Batch pull frameworks from Sammy slugs.")
    parser.add_argument(
        "--framework",
        action="append",
        default=[],
        help="Optional single framework id (repeatable). If omitted, run full Sammy batch.",
    )
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=0)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--retries", type=int, default=2)
    args = parser.parse_args()

    selected = set(args.framework or [])
    mappings = {
        fid: slug
        for fid, slug in SAMMY_MAPPINGS.items()
        if not selected or fid in selected
    }
    if not mappings:
        raise SystemExit("No frameworks selected for Sammy batch pull.")

    results = []
    for framework_id, slug in mappings.items():
        print(f"[RUN] {framework_id} <- {slug}")
        res = run_pull(
            framework_id=framework_id,
            slug=slug,
            concurrency=max(1, args.concurrency),
            max_pages=max(0, args.max_pages),
            timeout=max(5, args.timeout),
            retries=max(0, args.retries),
        )
        if res["ok"]:
            print(f"[OK] {framework_id}")
        else:
            print(f"[FAIL] {framework_id} rc={res['returncode']}")
            if res["stderr"]:
                print(res["stderr"])

        counts = None
        if res["ok"]:
            out_path = Path(f"public/data/frameworks/{framework_id}-en.json")
            fw = load_json(out_path)
            c, s, r = count_hierarchy(fw)
            counts = {"categories": c, "subcategories": s, "requirements": r}

        results.append(
            {
                "frameworkId": framework_id,
                "slug": slug,
                "ok": res["ok"],
                "counts": counts,
                "stdout": res["stdout"],
                "stderr": res["stderr"],
            }
        )

    # Update baselines for successful pulls.
    baseline_path = Path("scripts/frameworks/official-baselines.json")
    baseline = load_json(baseline_path)
    frameworks = baseline.get("frameworks") or {}
    today = date.today().isoformat()

    for item in results:
        if not item["ok"] or not item["counts"]:
            continue
        fid = item["frameworkId"]
        slug = item["slug"]
        entry = frameworks.get(fid, {})
        entry["canonicalLanguage"] = entry.get("canonicalLanguage") or "en"
        entry["expectedRequirements"] = item["counts"]["requirements"]
        entry["expectedCategories"] = item["counts"]["categories"]
        entry["expectedSubcategories"] = item["counts"]["subcategories"]
        entry["source"] = "Sammy Public Browse Snapshot"
        entry["sourceUrl"] = f"https://sammy.codific.com/browse/{slug}"
        entry["sourceVersion"] = f"Sammy snapshot {today}"
        frameworks[fid] = entry

    baseline["frameworks"] = frameworks
    save_json(baseline_path, baseline)

    report = {
        "checkedAt": today,
        "total": len(results),
        "success": sum(1 for r in results if r["ok"]),
        "failed": sum(1 for r in results if not r["ok"]),
        "results": results,
    }
    report_path = Path("docs/framework-checkpoints/sammy-batch-report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    save_json(report_path, report)

    print("")
    print(
        f"Sammy batch done: total={report['total']} "
        f"success={report['success']} failed={report['failed']}"
    )
    print(f"Report: {report_path}")

    if report["failed"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
