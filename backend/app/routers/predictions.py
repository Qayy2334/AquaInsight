from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Dataset, ModelRun
from ..services import ml
from ..services.repository import load_frame
from .deps import current_dataset

router = APIRouter(prefix="/api/models", tags=["models"])


def _run(r: ModelRun) -> dict:
    return {"id": r.id, "model_type": r.model_type, "target": r.target, "mae": r.mae, "rmse": r.rmse, "r2": r.r2,
            "train_size": r.train_size, "test_size": r.test_size, "feature_importance": r.feature_importance, "cv": r.cv,
            "created_at": r.created_at.isoformat() if r.created_at else None}


@router.post("/train")
def train(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    try:
        runs = ml.train_all(db, ds.id, load_frame(db, ds.id))
    except ValueError as e:
        raise HTTPException(422, str(e))
    return [_run(r) for r in runs]


@router.get("/runs")
def runs(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return [_run(r) for r in db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id)).all()]


@router.get("/predictions")
def predictions(target: str, ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    """Test-set actual vs predicted for both models, aligned by date."""
    runs = db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id, ModelRun.target == target)).all()
    if not runs:
        raise HTTPException(404, "No trained models for this target. Train first.")
    by_date: dict[str, dict] = {}
    for run in runs:
        for p in run.predictions:
            row = by_date.setdefault(p.date.isoformat(), {"date": p.date.isoformat(), "actual": p.actual})
            row[run.model_type] = p.predicted
    return {"target": target, "rows": sorted(by_date.values(), key=lambda r: r["date"]), "runs": [_run(r) for r in runs]}


@router.get("/next-day")
def next_day(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    return ml.predict_next_day(db, ds.id, load_frame(db, ds.id))
