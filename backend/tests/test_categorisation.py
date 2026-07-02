"""Smoke tests. Run with: pytest -q

These exist to catch regressions in the categorisation rules and the
precomputed views — the two places where the original code had real bugs.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.config import CATEGORY_RULES
from app.data_service import DataService, _categorise, _humanise


def test_categorisation_does_not_swallow_male_literate():
    """Original bug: Male_Literate_pct was sometimes routed to Demographics
    instead of Education because the if/elif chain checked 'male' before
    'literate'. Our ordered ruleset puts Education first."""
    assert _categorise("Male_Literate_pct") == "Education"
    assert _categorise("Female_Literate_pct") == "Education"


def test_categorisation_handles_workers():
    assert _categorise("Female_Workers_pct") == "Employment"
    assert _categorise("Cultivator_Workers_pct") == "Employment"


def test_categorisation_falls_through_to_demographics():
    assert _categorise("Male_pct") == "Demographics"
    assert _categorise("Female_pct") == "Demographics"


def test_categorisation_unknown_is_other():
    assert _categorise("Mystery_Column_pct") == "Other"


def test_humanise_strips_suffix():
    assert _humanise("Households_with_Internet_pct") == "Households With Internet"


def test_category_rules_are_well_formed():
    """Each rule is a 3-tuple of (str, list[str], list[str])."""
    for cat, must_any, must_not in CATEGORY_RULES:
        assert isinstance(cat, str) and cat
        assert isinstance(must_any, list) and must_any
        assert isinstance(must_not, list)
