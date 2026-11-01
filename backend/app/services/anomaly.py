"""Anomaly detection (proposal objective 3): IQR per variable vs Isolation Forest across variables.

A flagged record only means it differs from the historical pattern found by the method.
It is NOT evidence of unsafe water or treatment failure.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AnomalyResult, AnomalyRun
from .preprocess import prepare_for_analysis
from .variables import VARIABLE_KEYS


EPS = 1e-9


def iqr_bounds(df: pd.DataFrame, k: float) -> dict[str, tuple[float, float]]:
    bounds = {}
    for key in VARIABLE_KEYS:
        s = df[key].dropna()
        q1, q3 = s.quantile([0.25, 0.75])
        iqr = q3 - q1
        bounds[key] = (float(q1 - k * iqr), float(q3 + k * iqr))
    return bounds


def detect_all(db: Session, dataset_id: int, df: pd.DataFrame, iqr_k: float | None = None,
               contamination: float | None = None) -> dict:
    k = iqr_k if iqr_k is not None else settings.iqr_k
    cont = contamination if contamination is not None else settings.iforest_contamination
    db.execute(delete(AnomalyResult).where(AnomalyResult.dataset_id == dataset_id))
    db.execute(delete(AnomalyRun).where(AnomalyRun.dataset_id == dataset_id))

    # IQR on raw values (missing stays missing; nothing is invented).
    bounds = iqr_bounds(df, k)
    results: list[AnomalyResult] = []
    for row in df.itertuples(index=False):
        contributors = []
        for key in VARIABLE_KEYS:
            v = getattr(row, key)
            if v is None or pd.isna(v):
                continue
            lo, hi = bounds[key]
            # Tolerance so a value sitting exactly on a bound (e.g. 5.0 vs 4.9999999) is not flagged by float error.
            if v < lo - EPS or v > hi + EPS:
                width = (hi - lo) or 1.0
                excess = (lo - v) / width if v < lo else (v - hi) / width
                contributors.append({"variable": key, "value": float(v), "lower": lo, "upper": hi,
                                     "direction": "low" if v < lo else "high", "excess": float(excess)})
        if contributors:
            results.append(AnomalyResult(dataset_id=dataset_id, date=row.date.date(), method="iqr",
                                         score=max(c["excess"] for c in contributors), contributors=contributors))

    # Isolation Forest on standardized, gap-filled data.
    data = prepare_for_analysis(df)
    X = data[VARIABLE_KEYS]
    mu, sd = X.mean(), X.std().replace(0, 1)
    Z = (X - mu) / sd
    forest = IsolationForest(n_estimators=300, contamination=cont, random_state=42)
    labels = forest.fit_predict(Z)
    scores = -forest.score_samples(Z)  # higher = more unusual
    for i in np.where(labels == -1)[0]:
        z = Z.iloc[i]
        top = z.abs().sort_values(ascending=False).head(3)
        contributors = [{"variable": key, "value": float(X.iloc[i][key]), "z": float(z[key])} for key in top.index]
        results.append(AnomalyResult(dataset_id=dataset_id, date=data["date"].iloc[i].date(), method="iforest",
                                     score=float(scores[i]), contributors=contributors))

    db.add_all(results)
    db.add(AnomalyRun(dataset_id=dataset_id, iqr_k=k, contamination=cont, iqr_bounds=bounds))
    db.commit()
    return {
        "iqr_k": k,
        "contamination": cont,
        "iqr_bounds": bounds,
        "counts": {
            "iqr": sum(r.method == "iqr" for r in results),
            "iforest": sum(r.method == "iforest" for r in results),
        },
    }
