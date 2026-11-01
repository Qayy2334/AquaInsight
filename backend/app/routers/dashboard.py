"""Dashboard data: the single-day review view."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import AnomalyResult, AnomalyRun, Dataset, ModelRun
from ..services import anomaly
from ..services.repository import load_frame
from ..services.variables import VARIABLE_KEYS
from .deps import current_dataset

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

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
