"""Load uploaded spreadsheets, map columns, and produce a data-quality report."""

import io
import re
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
import pandas as pd

from .variables import COLUMN_ALIASES, VARIABLE_KEYS


def _normalize(header: str) -> str:
    return re.sub(r"[^0-9a-z一-鿿]", "", str(header).lower())


def map_columns(columns: list[str]) -> tuple[dict[str, str], list[str]]:
    """Return ({original_header: canonical_key}, [unmapped headers])."""
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for col in columns:
        norm = _normalize(col)
        for key, aliases in COLUMN_ALIASES.items():
            if key in used:
                continue
            if any(norm == a or norm.startswith(a) for a in aliases):
                mapping[col] = key
                used.add(key)
                break
    unmapped = [c for c in columns if c not in mapping]
    return mapping, unmapped


_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def read_docx_table(content: bytes) -> pd.DataFrame:
    """Read the first table of a .docx (the plant's daily log is kept as a Word table)."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    table = next(root.iter(f"{_W}tbl"), None)
    if table is None:
        raise ValueError("No table found in the Word document.")
    rows = [
        ["".join(t.text or "" for t in tc.iter(f"{_W}t")).strip() for tc in tr.findall(f"{_W}tc")]
        for tr in table.findall(f"{_W}tr")
    ]
    rows = [r for r in rows if any(r)]
    return pd.DataFrame(rows[1:], columns=rows[0])


def read_upload(filename: str, content: bytes) -> pd.DataFrame:
    name = filename.lower()
    # Read everything as text so cleaning can see and report malformed values.
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content), dtype=str)
    if name.endswith(".docx"):
        return read_docx_table(content)
    return pd.read_excel(io.BytesIO(content), dtype=str)


def _parse_dates(s: pd.Series) -> pd.Series:
    text = s.astype(str).str.strip()
    # "2026.8.1" / "2026/8/1" / "2026-8-1" style dates used in the plant log.
    dotted = pd.to_datetime(text.str.replace(r"[./]", "-", regex=True), format="%Y-%m-%d", errors="coerce")
    fallback = pd.to_datetime(text, errors="coerce")
    return dotted.fillna(fallback)


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Map, type-coerce, dedupe and sort. Missing values are kept as NaN (stored as NULL)."""
    mapping, unmapped = map_columns(list(raw.columns))
    missing_cols = [k for k in ["date", *VARIABLE_KEYS] if k not in mapping.values()]
    if "date" in missing_cols:
        raise ValueError("Could not find a date column. Expected a header like 'Date'.")

    df = raw.rename(columns=mapping)[[c for c in ["date", *VARIABLE_KEYS] if c in mapping.values()]].copy()
    for key in missing_cols:
        df[key] = np.nan

    rows_in = len(df)
    df["date"] = _parse_dates(df["date"])
    invalid_dates = int(df["date"].isna().sum())
    df = df.dropna(subset=["date"])
    df["date"] = df["date"].dt.normalize()

    non_numeric: dict[str, int] = {}
    corrections: list[dict] = []
    for key in VARIABLE_KEYS:
        text = df[key].astype("string").str.strip().replace("", pd.NA)
        # A single comma between digits is a decimal-separator typo, e.g. "7,58" -> 7.58.
        comma = text.str.fullmatch(r"\d+,\d+").fillna(False)
        for idx in df.index[comma]:
            corrections.append({"date": df.at[idx, "date"].date().isoformat(), "variable": key,
                                "raw": str(text[idx]), "value": float(str(text[idx]).replace(",", "."))})
        text = text.where(~comma, text.str.replace(",", ".", regex=False))
        before = text.notna().sum()
        df[key] = pd.to_numeric(text, errors="coerce")
        non_numeric[key] = int(before - df[key].notna().sum())

    dup_mask = df.duplicated(subset=["date"])
    duplicates = int(dup_mask.sum())
    duplicate_dates = sorted({d.date().isoformat() for d in df.loc[dup_mask, "date"]})
    df = df.drop_duplicates(subset=["date"], keep="first").sort_values("date").reset_index(drop=True)

    report = build_quality_report(df)
    report.update(
        {
            "rows_in": rows_in,
            "invalid_dates_dropped": invalid_dates,
            "duplicate_dates_dropped": duplicates,
            "duplicate_dates": duplicate_dates,
            "non_numeric_values": non_numeric,
            "corrections": corrections,
            "column_mapping": mapping,
            "unmapped_columns": unmapped,
            "missing_columns": [c for c in missing_cols if c != "date"],
        }
    )
    return df, report


def build_quality_report(df: pd.DataFrame) -> dict:
    n = len(df)
    if n == 0:
        return {"rows": 0}
    full_range = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
    missing_days = int(len(full_range) - n)
    missing = {k: int(df[k].isna().sum()) for k in VARIABLE_KEYS}
    total_cells = n * len(VARIABLE_KEYS)
    completeness = 1 - sum(missing.values()) / total_cells if total_cells else 0
    return {
        "rows": n,
        "start_date": df["date"].min().date().isoformat(),
        "end_date": df["date"].max().date().isoformat(),
        "missing_days": missing_days,
        "missing_values": missing,
        "completeness": round(completeness, 4),
    }


def prepare_for_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """Fill gaps by time interpolation for modelling/EDA. Raw values stay untouched in the DB."""
    out = df.copy().set_index("date").sort_index()
    out[VARIABLE_KEYS] = out[VARIABLE_KEYS].interpolate(method="time", limit_direction="both")
    return out.reset_index()
