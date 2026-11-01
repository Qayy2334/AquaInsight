
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AnomalyResult, Dataset
from ..services import eda
from ..services.repository import load_frame
from ..services.variables import REFERENCE_RANGES, TARGETS, VARIABLE_KEYS, VARIABLES
from .deps import current_dataset

router = APIRouter(prefix="/api", tags=["analysis"])


def _check_var(name: str) -> str:
    if name not in VARIABLE_KEYS:
        raise HTTPException(400, f"Unknown variable '{name}'")
    return name


@router.get("/meta")
def meta():
    return {"variables": VARIABLES, "targets": TARGETS, "reference_ranges": REFERENCE_RANGES}


@router.get("/overview")
def overview(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    df = load_frame(db, ds.id)
    latest = df.iloc[-1]
    prev = df.iloc[-8:-1]
    kpis = {}
    for key in VARIABLE_KEYS:
        value = latest[key]
        avg7 = prev[key].mean()
        kpis[key] = {
            "latest": None if value != value else float(value),
            "avg_7d": None if avg7 != avg7 else float(avg7),
            "avg_all": float(df[key].mean()),
        }

    counts = dict(db.execute(select(AnomalyResult.method, func.count()).where(AnomalyResult.dataset_id == ds.id)
                             .group_by(AnomalyResult.method)).all())
    recent = db.scalars(select(AnomalyResult).where(AnomalyResult.dataset_id == ds.id)
                        .order_by(AnomalyResult.date.desc()).limit(5)).all()
    return {
        "dataset": {"id": ds.id, "name": ds.name, "source": ds.source, "row_count": ds.row_count},
        "latest_date": latest["date"].date().isoformat(),
        "kpis": kpis,
        "quality": ds.quality_report,
        "anomaly_counts": {"iqr": counts.get("iqr", 0), "iforest": counts.get("iforest", 0)},
        "recent_anomalies": [{"date": a.date.isoformat(), "method": a.method, "score": a.score,
                              "contributors": a.contributors} for a in recent],
    }


@router.get("/eda/stats")
def stats(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return eda.describe(load_frame(db, ds.id))


@router.get("/eda/histogram")
def histogram(variable: str = Query(...), bins: int = Query(20, ge=5, le=60),
              ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return eda.histogram(load_frame(db, ds.id), _check_var(variable), bins)


@router.get("/eda/correlation")
def correlation(method: str = Query("pearson", pattern="^(pearson|spearman)$"),
                ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return eda.correlation(load_frame(db, ds.id), method)


@router.get("/eda/scatter")
def scatter(x: str, y: str, ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return eda.scatter(load_frame(db, ds.id), _check_var(x), _check_var(y))
