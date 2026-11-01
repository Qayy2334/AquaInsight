"""CSV downloads for the report appendix (cleaned data, predictions, evaluation, anomalies)."""

import io

import pandas as pd
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AnomalyResult, Dataset, ModelRun
from ..services.repository import load_frame
from .deps import current_dataset

router = APIRouter(prefix="/api/export", tags=["export"])


def _csv(df: pd.DataFrame, filename: str) -> StreamingResponse:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    # BOM so Excel opens UTF-8 (Chinese dataset names) correctly.
    return StreamingResponse(iter(["﻿" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/records.csv")
def records(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    df = load_frame(db, ds.id)
    df["date"] = df["date"].dt.date
    return _csv(df, "cleaned_records.csv")


@router.get("/evaluation.csv")
def evaluation(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    runs = db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id)).all()
    rows = [{"target": r.target, "model": r.model_type, "test_mae": r.mae, "test_rmse": r.rmse, "test_r2": r.r2,
             "train_size": r.train_size, "test_size": r.test_size,
             "cv_mae_mean": (r.cv or {}).get("mae_mean"), "cv_mae_std": (r.cv or {}).get("mae_std"),
             "cv_rmse_mean": (r.cv or {}).get("rmse_mean")} for r in runs]
    return _csv(pd.DataFrame(rows), "model_evaluation.csv")


@router.get("/predictions.csv")
def predictions(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    runs = db.scalars(select(ModelRun).where(ModelRun.dataset_id == ds.id)).all()
    rows = [{"target": r.target, "model": r.model_type, "date": p.date, "actual": p.actual, "predicted": p.predicted,
             "error": p.actual - p.predicted} for r in runs for p in r.predictions]
    return _csv(pd.DataFrame(rows), "test_predictions.csv")


@router.get("/anomalies.csv")
def anomalies(ds: Dataset = Depends(current_dataset), db: Session = Depends(get_db)):
    results = db.scalars(select(AnomalyResult).where(AnomalyResult.dataset_id == ds.id).order_by(AnomalyResult.date)).all()
    rows = [{"date": a.date, "method": a.method, "score": a.score,
             "contributors": "; ".join(f"{c['variable']}={c['value']}" for c in a.contributors)} for a in results]
    return _csv(pd.DataFrame(rows), "anomalies.csv")
