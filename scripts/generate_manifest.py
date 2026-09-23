"""
Scans the papers/ folder and rebuilds data/papers-manifest.json.

Expects files named:
  papers/<subject>/<level>/<year>-exam-paper-paper-<1 or 2>.pdf
  papers/<subject>/<level>/<year>-marking-scheme.pdf                (combined)
  papers/<subject>/<level>/<year>-marking-scheme-paper-<1 or 2>.pdf (split, if a
                                                                      subject ever
                                                                      needs it)

subject must be one of: english, irish, maths, economics, biology, geography
level must be one of: ordinary, higher

Anything that doesn't match this pattern is skipped, so unrelated files
(README, .gitkeep, etc.) in the papers folder are safely ignored.

Run manually with: python scripts/generate_manifest.py
The GitHub Action in .github/workflows/generate-manifest.yml runs this
automatically whenever anything under papers/ changes.
"""

import json
import os
import re

PAPERS_DIR = "papers"
OUTPUT = "data/papers-manifest.json"

SUBJECT_LABELS = {
    "english": "English", "irish": "Irish", "maths": "Maths",
    "economics": "Economics", "biology": "Biology", "geography": "Geography",
}
LEVEL_LABELS = {"ordinary": "Ordinary level", "higher": "Higher level"}
TYPE_LABELS = {"exam-paper": "Exam paper", "marking-scheme": "Marking scheme"}

FILENAME_RE = re.compile(
    r"^(\d{4})-(exam-paper|marking-scheme)(?:-paper-(\d))?\.pdf$",
    re.IGNORECASE,
)


def build_entries():
    entries = []
    if not os.path.isdir(PAPERS_DIR):
        return entries

    for subject in sorted(os.listdir(PAPERS_DIR)):
        subject_path = os.path.join(PAPERS_DIR, subject)
        if not os.path.isdir(subject_path) or subject not in SUBJECT_LABELS:
            continue

        for level in sorted(os.listdir(subject_path)):
            level_path = os.path.join(subject_path, level)
            if not os.path.isdir(level_path) or level not in LEVEL_LABELS:
                continue

            for filename in sorted(os.listdir(level_path)):
                match = FILENAME_RE.match(filename)
                if not match:
                    continue

                year, ptype, paper_num = match.groups()
                ptype = ptype.lower()
                path = f"{PAPERS_DIR}/{subject}/{level}/{filename}"

                label = (
                    f"{SUBJECT_LABELS[subject]} \u2014 {LEVEL_LABELS[level]} "
                    f"\u2014 {year} \u2014 {TYPE_LABELS[ptype]}"
                )
                if paper_num:
                    label += f" \u2014 Paper {paper_num}"
                elif ptype == "marking-scheme":
                    label += " (Paper 1 & 2)"

                entries.append(
                    {
                        "subject": subject,
                        "level": level,
                        "year": int(year),
                        "type": ptype,
                        "path": path,
                        "label": label,
                    }
                )

    entries.sort(key=lambda e: (e["subject"], e["level"], -e["year"], e["type"]))
    return entries


def main():
    entries = build_entries()
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {len(entries)} entries to {OUTPUT}")


if __name__ == "__main__":
    main()
