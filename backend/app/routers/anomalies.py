from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import AnomalyResult, AnomalyRun, Dataset
from ..services import anomaly
from ..services.repository import load_frame
from .deps import current_dataset

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


class DetectParams(BaseModel):
    iqr_k: float = Field(settings.iqr_k, gt=0, le=5)
    contamination: float = Field(settings.iforest_contamination, gt=0, le=0.5)


@router.post("/detect")
def detect(params: DetectParams, ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return anomaly.detect_all(db, ds.id, load_frame(db, ds.id), params.iqr_k, params.contamination)


@router.get("")
def list_anomalies(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    """One row per flagged date, merging the two methods so the UI can show agreement."""
    results = db.scalars(select(AnomalyResult).where(AnomalyResult.dataset_id == ds.id)
                         .order_by(AnomalyResult.date)).all()
    merged: dict[str, dict] = {}
    for r in results:
        row = merged.setdefault(r.date.isoformat(), {"date": r.date.isoformat(), "methods": [], "details": {}})
        row["methods"].append(r.method)
        row["details"][r.method] = {"score": r.score, "contributors": r.contributors}
    run = db.scalars(select(AnomalyRun).where(AnomalyRun.dataset_id == ds.id)).first()
    return {
        "items": list(merged.values()),
        "params": {"iqr_k": run.iqr_k, "contamination": run.contamination} if run else None,
        "iqr_bounds": run.iqr_bounds if run else {},
    }
