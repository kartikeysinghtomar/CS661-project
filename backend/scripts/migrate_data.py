#!/usr/bin/env python
"""Migrate the original project's data files into the new layout.

Usage:
    python scripts/migrate_data.py /path/to/old/project

Copies CSVs into backend/data/ and GeoJSONs into backend/data/geojson/.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

CSV_NAMES = {
    "statewiseaggregated.csv",
    "districtwise_data_percentages11_incsv.csv",
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_dir():
        print(f"Not a directory: {src}")
        return 1

    backend_data = Path(__file__).resolve().parent.parent / "data"
    geo_dir = backend_data / "geojson"
    backend_data.mkdir(parents=True, exist_ok=True)
    geo_dir.mkdir(parents=True, exist_ok=True)

    moved = 0
    for f in src.rglob("*"):
        if f.is_file() and f.name in CSV_NAMES:
            shutil.copy2(f, backend_data / f.name)
            print(f"  csv  → {f.name}")
            moved += 1
        elif f.suffix.lower() == ".geojson":
            shutil.copy2(f, geo_dir / f.name)
            print(f"  geo  → {f.name}")
            moved += 1
        elif f.name == "india.json":
            shutil.copy2(f, geo_dir / "india.geojson")
            print(f"  geo  → india.geojson (renamed from india.json)")
            moved += 1

    print(f"\nMoved {moved} files.")
    print("Next: cd frontend && npm run geo:build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
