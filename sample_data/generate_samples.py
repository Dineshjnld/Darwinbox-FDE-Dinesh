from pathlib import Path

import pandas as pd


ROOT = Path(__file__).parent
if not (ROOT / "employees_legacy.xlsx").exists():
    frame = pd.read_csv(ROOT / "employees_legacy.csv", dtype=str)
    frame.to_excel(ROOT / "employees_legacy.xlsx", index=False)

