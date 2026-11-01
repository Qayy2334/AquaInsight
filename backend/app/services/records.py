"""Day-based record management: merge uploads into the store, edit single days, keep an audit trail.

Every change triggers a re-analysis (model training + anomaly detection) over all days.
"""

import math
from datetime import date

import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import AnomalyResult, AnomalyRun, Dataset, ModelRun, RecordChange, Upload, WaterRecord
from . import anomaly, ml
from .preprocess import build_quality_report
from .repository import load_frame
from .variables import VARIABLE_KEYS

TOL = 1e-9
MIN_DAYS_FOR_ANALYSIS = 10


def _clean(v) -> float | None:
    if v is None:
        return None
    v = float(v)
    return None if math.isnan(v) else v


def _values(obj) -> dict[str, float | None]:
    """Six variable values from a WaterRecord, a DataFrame row (namedtuple) or a dict."""
    get = obj.get if isinstance(obj, dict) else (lambda k: getattr(obj, k))
    return {k: _clean(get(k)) for k in VARIABLE_KEYS}


def _differs(a: dict, b: dict) -> list[str]:
    out = []
    for k in VARIABLE_KEYS:
        x, y = a.get(k), b.get(k)
        if (x is None) != (y is None) or (x is not None and abs(x - y) > TOL):
            out.append(k)
    return out


def _existing(db: Session, store: Dataset) -> dict[date, WaterRecord]:
    return {r.date: r for r in db.scalars(select(WaterRecord).where(WaterRecord.dataset_id == store.id)).all()}


def preview(db: Session, store: Dataset, df: pd.DataFrame) -> dict:
    """Classify each day in a cleaned upload as new, conflicting (different values) or identical."""
    existing = _existing(db, store)
    new, conflicts, identical = [], [], []
    for row in df.itertuples(index=False):
        d = row.date.date()
        vals = _values(row)
        if d not in existing:
            new.append({"date": d.isoformat(), "values": vals})
            continue
        old = _values(existing[d])
        diff = _differs(old, vals)
        if diff:
            conflicts.append({"date": d.isoformat(), "old": old, "new": vals, "changed": diff})
        else:
            identical.append(d.isoformat())
    return {"new": new, "conflicts": conflicts, "identical": identical}


def commit_upload(db: Session, store: Dataset, df: pd.DataFrame, filename: str, file_report: dict,
                  overwrite: set[str]) -> tuple[Upload, list[str]]:
    """Add new days; replace conflicting days only if their date is in `overwrite`."""
    p = preview(db, store, df)
    upload = Upload(filename=filename, file_report=file_report)
    db.add(upload)
    db.flush()
    existing = _existing(db, store)
    source = f"upload: {filename}"

    for item in p["new"]:
        d = date.fromisoformat(item["date"])
        db.add(WaterRecord(dataset_id=store.id, date=d, upload_id=upload.id, **item["values"]))
        db.add(RecordChange(date=d, action="create", source=source, new_values=item["values"]))
    updated = 0
    for item in p["conflicts"]:
        if item["date"] not in overwrite:
            continue
        rec = existing[date.fromisoformat(item["date"])]
        for k, v in item["new"].items():
            setattr(rec, k, v)
        rec.upload_id = upload.id
        db.add(RecordChange(date=rec.date, action="update", source=source, old_values=item["old"], new_values=item["new"]))
        updated += 1

    upload.added = len(p["new"])
    upload.updated = updated
    upload.skipped = len(p["identical"]) + len(p["conflicts"]) - updated
    db.commit()
    return upload, refresh(db, store)


def create_record(db: Session, store: Dataset, d: date, values: dict) -> list[str]:
    if d in _existing(db, store):
        raise ValueError(f"A record for {d.isoformat()} already exists. Edit it instead.")
    vals = _values(values)
    db.add(WaterRecord(dataset_id=store.id, date=d, upload_id=None, **vals))
    db.add(RecordChange(date=d, action="create", source="manual", new_values=vals))
    db.commit()
    return refresh(db, store)


def update_record(db: Session, store: Dataset, d: date, values: dict) -> list[str]:
    rec = _existing(db, store).get(d)
    if rec is None:
        raise LookupError(f"No record for {d.isoformat()}.")
    old, new = _values(rec), _values(values)
    if not _differs(old, new):
        return []
    for k, v in new.items():
        setattr(rec, k, v)
    rec.upload_id = None
    db.add(RecordChange(date=d, action="update", source="manual", old_values=old, new_values=new))
    db.commit()
    return refresh(db, store)


def delete_record(db: Session, store: Dataset, d: date) -> list[str]:
    rec = _existing(db, store).get(d)
    if rec is None:
        raise LookupError(f"No record for {d.isoformat()}.")
    db.add(RecordChange(date=d, action="delete", source="manual", old_values=_values(rec)))
    db.delete(rec)
    db.commit()
    return refresh(db, store)


def refresh(db: Session, store: Dataset) -> list[str]:
    """Recompute the store's quality summary and re-run models and anomaly detection on all days."""
    df = load_frame(db, store.id)
    store.row_count = len(df)
    store.quality_report = build_quality_report(df)
    db.commit()

    warnings: list[str] = []
    if df.empty:
        for model in (ModelRun, AnomalyResult, AnomalyRun):
            db.execute(delete(model).where(model.dataset_id == store.id))
        db.commit()
        return warnings
    if len(df) < MIN_DAYS_FOR_ANALYSIS:
        for model in (ModelRun, AnomalyResult, AnomalyRun):
            db.execute(delete(model).where(model.dataset_id == store.id))
        db.commit()
        return [f"Analysis needs at least {MIN_DAYS_FOR_ANALYSIS} days of records ({len(df)} so far)."]
    try:
        ml.train_all(db, store.id, df)
    except ValueError as e:
        db.rollback()
        db.execute(delete(ModelRun).where(ModelRun.dataset_id == store.id))
        db.commit()
        warnings.append(f"Models not trained: {e}")
    # Re-use the anomaly parameters the user last chose.
    last = db.scalars(select(AnomalyRun).where(AnomalyRun.dataset_id == store.id)).first()
    anomaly.detect_all(db, store.id, df, last.iqr_k if last else None, last.contamination if last else None)
    return warnings
