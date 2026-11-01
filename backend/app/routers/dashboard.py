"""Dashboard data: dataset-level summary and the single-day review view."""

from datetime import date, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import AnomalyResult, AnomalyRun, Dataset, ModelRun
from ..services import anomaly
from ..services.repository import load_frame
from ..services.variables import REFERENCE_RANGES, TARGETS, VARIABLE_KEYS
from .deps import current_dataset

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

ML_MODELS = ("linear_regression", "random_forest")


def _bounds(db: Session, ds_id: int, df) -> tuple[dict, float]:
    run = db.scalars(select(AnomalyRun).where(AnomalyRun.dataset_id == ds_id)).first()
    if run:
        return run.iqr_bounds, run.iqr_k
    return anomaly.iqr_bounds(df, settings.iqr_k), settings.iqr_k


def _flags_by_date(db: Session, ds_id: int) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in db.scalars(select(AnomalyResult).where(AnomalyResult.dataset_id == ds_id)).all():
        out.setdefault(r.date.isoformat(), {})[r.method] = {"score": r.score, "contributors": r.contributors}
    return out


def _within(values, ref: dict) -> int:
    ok = np.ones(len(values), dtype=bool)
    if "min" in ref:
        ok &= values >= ref["min"]
    if "max" in ref:
        ok &= values <= ref["max"]
    return int(ok.sum())


@router.get("/summary")
def summary(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    df = load_frame(db, ds.id)
    q = ds.quality_report or {}

    # Treatment effect: influent vs outlet means.
    treatment = {}
    for name, (inf, out) in {"turbidity": ("influent_turbidity", "outlet_turbidity"), "ph": ("influent_ph", "outlet_ph")}.items():
        a, b = float(df[inf].mean()), float(df[out].mean())
        treatment[name] = {"influent_mean": a, "outlet_mean": b, "change_pct": (b - a) / a * 100 if a else None,
                           "days_outlet_above_influent": int((df[out] > df[inf]).sum())}

    # Strongest pairwise correlation (off-diagonal).
    corr = df[VARIABLE_KEYS].corr()
    pairs = [(VARIABLE_KEYS[i], VARIABLE_KEYS[j], float(corr.iloc[i, j]))
             for i in range(len(VARIABLE_KEYS)) for j in range(i + 1, len(VARIABLE_KEYS)) if not np.isnan(corr.iloc[i, j])]
    pairs.sort(key=lambda p: abs(p[2]), reverse=True)

    # Share of days within reference ranges.
    compliance = []
    for key, ref in REFERENCE_RANGES.items():
        s = df[key].dropna()
        compliance.append({"variable": key, "within": _within(s.to_numpy(), ref), "total": int(len(s)),
                           "min": ref.get("min"), "max": ref.get("max"), "note": ref["note"]})

    # Predictability verdict: best ML model vs historical-mean reference on CV MAE.
    runs = db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id)).all()
    verdict = []
    for t in TARGETS:
        by_type = {r.model_type: r for r in runs if r.target == t and r.cv}
        ml = [by_type[m] for m in ML_MODELS if m in by_type]
        mean = by_type.get("historical_mean")
        if not ml or not mean:
            continue
        best = min(ml, key=lambda r: r.cv["mae_mean"])
        verdict.append({"target": t, "best_model": best.model_type, "best_cv_mae": best.cv["mae_mean"],
                        "mean_cv_mae": mean.cv["mae_mean"], "beats_mean": best.cv["mae_mean"] < mean.cv["mae_mean"]})

    flags = _flags_by_date(db, ds.id)
    both = [{"date": d, **v} for d, v in sorted(flags.items()) if {"iqr", "iforest"} <= set(v)]
    return {
        "dataset": {"id": ds.id, "name": ds.name, "source": ds.source, "rows": ds.row_count,
                    "start_date": q.get("start_date"), "end_date": q.get("end_date")},
        "quality": {"completeness": q.get("completeness"), "missing_days": q.get("missing_days"),
                    "corrections": len(q.get("corrections") or []), "duplicates": q.get("duplicate_dates_dropped", 0)},
        "treatment": treatment,
        "top_correlations": [{"a": a, "b": b, "r": r} for a, b, r in pairs[:3]],
        "compliance": compliance,
        "predictability": verdict,
        "anomalies": {
            "iqr": sum("iqr" in v for v in flags.values()),
            "iforest": sum("iforest" in v for v in flags.values()),
            "both": len(both),
            "flagged_dates": sorted(flags),
            "both_details": both,
        },
    }


@router.get("/day")
def day(date: date, ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    df = load_frame(db, ds.id)
    dates = [d.date() for d in df["date"]]
    if date not in dates:
        raise HTTPException(404, f"No record for {date.isoformat()} in this dataset.")
    idx = dates.index(date)
    row = df.iloc[idx]
    bounds, k = _bounds(db, ds.id, df)

    variables = {}
    for key in VARIABLE_KEYS:
        s = df[key].dropna()
        v = row[key]
        lo, hi = bounds[key]
        value = None if v != v else float(v)
        status = None
        if value is not None:
            status = "low" if value < lo - anomaly.EPS else "high" if value > hi + anomaly.EPS else "normal"
        variables[key] = {
            "value": value,
            "median": float(s.median()),
            "min": float(s.min()),
            "max": float(s.max()),
            "q1": float(s.quantile(0.25)),
            "q3": float(s.quantile(0.75)),
            "lower": lo,
            "upper": hi,
            "percentile": None if value is None else float((s < value).mean() * 100 + (s == value).mean() * 50),
            "status": status,
        }

    # Test-period predictions for this date (only exists for the hold-out days).
    predictions: dict[str, dict] = {}
    for run in db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id)).all():
        for p in run.predictions:
            if p.date == date:
                predictions.setdefault(run.target, {"actual": p.actual})[run.model_type] = p.predicted

    window = df.iloc[max(0, idx - 3): idx + 4]
    neighbours = [{"date": r["date"].date().isoformat(), **{key: (None if r[key] != r[key] else float(r[key])) for key in VARIABLE_KEYS}}
                  for _, r in window.iterrows()]

    return {
        "date": date.isoformat(),
        "prev_date": dates[idx - 1].isoformat() if idx > 0 else None,
        "next_date": dates[idx + 1].isoformat() if idx < len(dates) - 1 else None,
        "is_consecutive_prev": idx > 0 and dates[idx] - dates[idx - 1] == timedelta(days=1),
        "iqr_k": k,
        "variables": variables,
        "anomaly": _flags_by_date(db, ds.id).get(date.isoformat()),
        "predictions": predictions,
        "neighbours": neighbours,
    }
