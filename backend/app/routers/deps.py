from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Dataset
from ..services.repository import get_store


def current_dataset(db: Session = Depends(get_db)) -> Dataset:
    """The record store, for analysis endpoints that need at least one record."""
    store = get_store(db)
    if not store.row_count:
        raise HTTPException(404, "No records yet. Upload a file or add a day in Data Management.")
    return store
