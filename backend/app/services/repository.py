"""DB <-> DataFrame helpers."""

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Dataset, WaterRecord
from .variables import VARIABLE_KEYS


def get_store(db: Session) -> Dataset:
    """The single record store all daily records belong to (created on first use)."""
    store = db.scalars(select(Dataset).order_by(Dataset.id).limit(1)).first()
    if store is None:
        store = Dataset(name=settings.seed_name, source="upload", row_count=0)
        db.add(store)
        db.commit()
    return store


def load_frame(db: Session, dataset_id: int) -> pd.DataFrame:
    rows = db.scalars(
        select(WaterRecord).where(WaterRecord.dataset_id == dataset_id).order_by(WaterRecord.date)
    ).all()
    df = pd.DataFrame([{"date": r.date, **{k: getattr(r, k) for k in VARIABLE_KEYS}} for r in rows])
    if df.empty:
        return pd.DataFrame(columns=["date", *VARIABLE_KEYS])
    df["date"] = pd.to_datetime(df["date"])
    return df
