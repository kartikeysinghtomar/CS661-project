"""Configuration. Single source of truth — no module-level globals scattered across files."""

from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    state_csv: str = "statewiseaggregated.csv"
    district_csv: str = "districtwise_data_percentages11_incsv.csv"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://censusscope.vercel.app",  # placeholder for deployed frontend
    ]


settings = Settings()


# Categorization rules. The original code substring-matched on column names
# inside a single if/elif chain with an indentation bug that silently dropped
# columns. Here categorization is declarative, ordered (first match wins), and
# unit-testable.
CATEGORY_RULES: list[tuple[str, list[str], list[str]]] = [
    # (category, must-contain-any, must-not-contain-any)
    ("Education", ["literate", "education", "primary", "secondary", "graduate"], ["total_education"]),
    ("Employment", ["worker", "employment", "cultivator", "agricultural"], []),
    ("Social", ["sc_", "st_", "caste"], []),
    ("Religion", ["hindu", "muslim", "christian", "sikh", "buddhist", "jain", "religion"], []),
    ("Amenities", ["household", "lpg", "electric", "internet", "computer", "bicycle", "car", "tv", "telephone", "scooter"], []),
    ("Water_Sanitation", ["water", "latrine", "drinking"], []),
    ("Economic", ["power_parity", "rs_"], []),
    ("Age", ["age_group"], []),
    ("Demographics", ["male", "female"], []),  # catch-all gender — last so it doesn't swallow Male_Literate etc.
]
