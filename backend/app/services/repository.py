"""DB <-> DataFrame helpers."""

import math

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Dataset, WaterRecord
from .preprocess import build_quality_report
from .variables import VARIABLE_KEYS


def active_dataset(db: Session, dataset_id: int | None = None) -> Dataset | None:
    if dataset_id is not None:
        return db.get(Dataset, dataset_id)
    return db.scalars(select(Dataset).order_by(Dataset.id.desc()).limit(1)).first()


def load_frame(db: Session, dataset_id: int) -> pd.DataFrame:
    rows = db.scalars(
        select(WaterRecord).where(WaterRecord.dataset_id == dataset_id).order_by(WaterRecord.date)
    ).all()
    df = pd.DataFrame([{"date": r.date, **{k: getattr(r, k) for k in VARIABLE_KEYS}} for r in rows])
    if df.empty:
        return pd.DataFrame(columns=["date", *VARIABLE_KEYS])
    df["date"] = pd.to_datetime(df["date"])
    return df


def _none_if_nan(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)


def save_dataset(db: Session, name: str, df: pd.DataFrame, report: dict | None = None, source: str = "upload") -> Dataset:
    ds = Dataset(name=name, source=source, row_count=len(df), quality_report=report or build_quality_report(df))
    db.add(ds)
    db.flush()
    db.bulk_save_objects(
        [
            WaterRecord(dataset_id=ds.id, date=row.date.date(), **{k: _none_if_nan(getattr(row, k)) for k in VARIABLE_KEYS})
            for row in df.itertuples(index=False)
        ]
    )
    db.commit()
    return ds
