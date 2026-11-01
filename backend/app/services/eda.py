"""Exploratory data analysis: descriptive stats, distributions, correlation."""

import numpy as np
import pandas as pd

from .variables import VARIABLE_KEYS


def describe(df: pd.DataFrame) -> list[dict]:
    out = []
    for key in VARIABLE_KEYS:
        s = df[key].dropna()
        if s.empty:
            out.append({"variable": key, "count": 0})
            continue
        q1, q3 = s.quantile([0.25, 0.75])
        out.append(
            {
                "variable": key,
                "count": int(s.count()),
                "missing": int(df[key].isna().sum()),
                "mean": float(s.mean()),
                "std": float(s.std()),
                "min": float(s.min()),
                "q1": float(q1),
                "median": float(s.median()),
                "q3": float(q3),
                "max": float(s.max()),
            }
        )
    return out


def histogram(df: pd.DataFrame, variable: str, bins: int = 20) -> dict:
    s = df[variable].dropna()
    counts, edges = np.histogram(s, bins=bins)
    return {"variable": variable, "counts": counts.tolist(), "edges": [float(e) for e in edges]}


def correlation(df: pd.DataFrame, method: str = "pearson") -> dict:
    corr = df[VARIABLE_KEYS].corr(method=method)
    return {"variables": VARIABLE_KEYS, "matrix": corr.round(3).fillna(0).values.tolist(), "method": method}


def scatter(df: pd.DataFrame, x: str, y: str) -> dict:
    sub = df[["date", x, y]].dropna()
    slope, intercept = (np.polyfit(sub[x], sub[y], 1) if len(sub) > 1 else (0.0, 0.0))
    return {
        "x": x,
        "y": y,
        "points": [[float(a), float(b), d.date().isoformat()] for d, a, b in sub.itertuples(index=False)],
        "trend": {"slope": float(slope), "intercept": float(intercept)},
    }
