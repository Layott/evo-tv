"""
Regenerate db/epg/week-1.csv from the source EPG PDF.

    python scripts/epg-pdf-to-csv.py <source.pdf> [out.csv]

Requires pdfplumber. The PDF is not an interchange format and next week's file
will differ, so the CSV is what gets committed and what scripts/import-epg.ts
reads. Two real defects in the source are handled here:

  1. Every day's 23:00 slot has its end time written as 12:00:00, which taken
     literally is a negative duration. Durations are derived from the next
     slot's start instead, and the final slot of a day runs to 24:00.
  2. Slot code A18 appears twice. Codes are provenance only, never a key, which
     is why epg_slots is unique on (day_of_week, start_minute).

Titles are transcribed verbatim, decorative emoji included. import-epg.ts
strips them, so this stays a lossless transcription of the source.
"""
import csv
import io
import os
import re
import sys

import pdfplumber

DAY_LETTER = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6, "G": 7}
DAY_NAME = {
    1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY",
    5: "FRIDAY", 6: "SATURDAY", 7: "SUNDAY",
}


def to_minutes(t):
    t = (t or "").strip()
    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", t)
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    pdf_path = sys.argv[1]
    out_csv = sys.argv[2] if len(sys.argv) > 2 else os.path.join("db", "epg", "week-1.csv")

    raw = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                raw.extend(table)

    slots = []
    for row in raw:
        cells = [(c or "").strip() for c in row]
        if len(cells) < 11 or cells[1].lower().startswith("start"):
            continue
        start = to_minutes(cells[1])
        if start is None:
            continue
        code = cells[10].strip().upper()
        m = re.match(r"^([A-G])(\d{2})$", code)
        if not m:
            print(f"skipping row with bad slot code {code!r}", file=sys.stderr)
            continue
        slots.append({
            "day": DAY_LETTER[m.group(1)],
            "slot_code": code,
            "start_raw": cells[1],
            "start_minute": start,
            "title": re.sub(r"\s+", " ", cells[4]).strip(),
            "genre_id": cells[6].strip(),
            "subgenre_id": cells[7].strip(),
            "rating": cells[8].strip(),
        })

    by_day = {}
    for s in slots:
        by_day.setdefault(s["day"], []).append(s)

    out = []
    for day in sorted(by_day):
        day_slots = sorted(by_day[day], key=lambda s: s["start_minute"])
        for i, s in enumerate(day_slots):
            nxt = day_slots[i + 1]["start_minute"] if i + 1 < len(day_slots) else 1440
            s["duration_min"] = nxt - s["start_minute"]
            out.append(s)

    print(f"total slots: {len(out)}")
    for day in sorted(by_day):
        ds = [s for s in out if s["day"] == day]
        mins = sum(s["duration_min"] for s in ds)
        starts = [s["start_minute"] for s in ds]
        dupes = len(starts) - len(set(starts))
        print(f"  day {day} {DAY_NAME[day]:<10} slots={len(ds):>3} minutes={mins} dup_starts={dupes}")

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with io.open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["day", "start", "duration_min", "title", "genre_id",
                    "subgenre_id", "rating", "slot_code"])
        for s in out:
            w.writerow([s["day"], s["start_raw"], s["duration_min"], s["title"],
                        s["genre_id"], s["subgenre_id"], s["rating"], s["slot_code"]])

    print(f"wrote {out_csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
