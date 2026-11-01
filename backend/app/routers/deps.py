from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Dataset
from ..services.repository import active_dataset


def current_dataset(dataset_id: int | None = Query(None), db: Session = Depends(get_db)) -> Dataset:
    ds = active_dataset(db, dataset_id)
    if ds is None:
        raise HTTPException(404, "No dataset loaded. Upload an Excel file first.")
    return ds
