"""Data loading and cleaning rules (proposal objective 1)."""

import pandas as pd
import pytest

from app.services.preprocess import clean, map_columns, read_upload


def test_reads_plant_docx_table(seed_bytes):
    raw = read_upload("plant.docx", seed_bytes)
    assert len(raw) == 61
    assert raw.columns[0] == "日期项目"


def test_maps_chinese_plant_headers(seed_bytes):
    mapping, unmapped = map_columns(list(read_upload("plant.docx", seed_bytes).columns))
    assert set(mapping.values()) == {"date", "influent_turbidity", "influent_ph", "naocl_dosage",
                                     "outlet_turbidity", "outlet_ph", "outlet_free_chlorine"}
    assert unmapped == []


def test_maps_english_headers_with_units():
    mapping, _ = map_columns(["Date", "Influent Turbidity (NTU)", "Influent pH", "Sodium Hypochlorite Dosage",
                              "Outlet Turbidity", "Outlet pH", "Outlet Free Chlorine (mg/L)", "Remarks"])
    assert mapping["Outlet Free Chlorine (mg/L)"] == "outlet_free_chlorine"
    assert "Remarks" not in mapping


def test_real_data_values_preserved(seed_bytes):
    df, report = clean(read_upload("plant.docx", seed_bytes))
    assert len(df) == 61
    assert report["start_date"] == "2026-08-01" and report["end_date"] == "2026-09-30"
    row = df.set_index("date").loc["2026-09-16"]
    assert row["naocl_dosage"] == 1.0 and row["outlet_free_chlorine"] == 0.05
    assert report["missing_days"] == 0 and report["completeness"] == 1.0


def test_comma_decimal_typo_corrected_and_reported(seed_bytes):
    df, report = clean(read_upload("plant.docx", seed_bytes))
    assert df.set_index("date").loc["2026-08-07", "outlet_ph"] == pytest.approx(7.58)
    assert report["corrections"] == [{"date": "2026-08-07", "variable": "outlet_ph", "raw": "7,58", "value": 7.58}]


def _frame(rows):
    return pd.DataFrame(rows, columns=["Date", "Influent Turbidity", "Influent pH", "NaOCl Dosage",
                                       "Outlet Turbidity", "Outlet pH", "Outlet Free Chlorine"])


def test_dotted_dates_duplicates_and_sorting():
    raw = _frame([["2026.8.2", "1", "7", "3", "0.1", "7.5", "0.3"],
                  ["2026.8.1", "1", "7", "3", "0.1", "7.5", "0.3"],
                  ["2026.8.2", "9", "9", "9", "9", "9", "9"]])
    df, report = clean(raw)
    assert list(df["date"].dt.strftime("%Y-%m-%d")) == ["2026-08-01", "2026-08-02"]
    assert report["duplicate_dates_dropped"] == 1
    assert df.iloc[1]["influent_turbidity"] == 1  # first occurrence kept


def test_invalid_dates_and_non_numeric_values():
    raw = _frame([["not a date", "1", "7", "3", "0.1", "7.5", "0.3"],
                  ["2026-08-01", "n/a", "7", "3", "0.1", "7.5", "0.3"]])
    df, report = clean(raw)
    assert len(df) == 1 and report["invalid_dates_dropped"] == 1
    assert pd.isna(df.iloc[0]["influent_turbidity"])
    assert report["non_numeric_values"]["influent_turbidity"] == 1
    assert report["missing_values"]["influent_turbidity"] == 1


def test_missing_date_column_rejected():
    with pytest.raises(ValueError):
        clean(pd.DataFrame({"a": [1], "b": [2]}))
