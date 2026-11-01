"""Day-based record management: list, upload (preview + commit), add, edit, delete, history."""

import json
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import RecordChange, Upload, WaterRecord
from ..services import records as svc
from ..services.preprocess import clean, read_upload
from ..services.repository import get_store
from ..services.variables import VARIABLE_KEYS

router = APIRouter(prefix="/api", tags=["records"])


class DayValues(BaseModel):
    influent_turbidity: float | None = None
    influent_ph: float | None = None
    naocl_dosage: float | None = None
    outlet_turbidity: float | None = None
    outlet_ph: float | None = None
    outlet_free_chlorine: float | None = None


class NewDay(DayValues):
    date: date


def _record(r: WaterRecord) -> dict:
    return {
        "date": r.date.isoformat(),
        **{k: getattr(r, k) for k in VARIABLE_KEYS},
        "source": f"upload: {r.upload.filename}" if r.upload else "manual",
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/records")
def list_records(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    store = get_store(db)
    q = select(WaterRecord).where(WaterRecord.dataset_id == store.id)
    if start:
        q = q.where(WaterRecord.date >= start)
    if end:
        q = q.where(WaterRecord.date <= end)
    return [_record(r) for r in db.scalars(q.order_by(WaterRecord.date)).all()]


@router.get("/records/summary")
def summary(db: Session = Depends(get_db)):
    store = get_store(db)
    return {"name": store.name, "rows": store.row_count, "quality": store.quality_report}


async def _read(file: UploadFile) -> tuple:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls", ".csv", ".docx")):
        raise HTTPException(400, "Please upload an .xlsx, .xls, .csv or .docx file.")
    content = await file.read()
    try:
        df, report = clean(read_upload(file.filename, content))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # unreadable file
        raise HTTPException(422, f"Could not read file: {e}")
    if df.empty:
        raise HTTPException(422, "No valid rows found after cleaning.")
    return df, report


@router.post("/records/upload/preview")
async def upload_preview(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Show what an upload would change, without writing anything."""
    df, report = await _read(file)
    return {"filename": file.filename, "file_report": report, **svc.preview(db, get_store(db), df)}


@router.post("/records/upload")
async def upload_commit(file: UploadFile = File(...), overwrite: str = Form("[]"), db: Session = Depends(get_db)):
    """Merge an upload into the records. `overwrite` is a JSON list of conflicting dates to replace."""
    df, report = await _read(file)
    try:
        dates = set(json.loads(overwrite))
    except json.JSONDecodeError:
        raise HTTPException(400, "overwrite must be a JSON list of dates")
    upload, warnings = svc.commit_upload(db, get_store(db), df, file.filename, report, dates)
    if report.get("duplicate_dates"):
        dd = report["duplicate_dates"]
        warnings.insert(0, f"{len(dd)} date(s) appeared more than once in the file; the first row was used: "
                        + ", ".join(dd[:10]) + (" …" if len(dd) > 10 else ""))
    return {"id": upload.id, "filename": upload.filename, "added": upload.added, "updated": upload.updated,
            "skipped": upload.skipped, "file_report": report, "warnings": warnings}


@router.get("/uploads")
def uploads(db: Session = Depends(get_db)):
    rows = db.scalars(select(Upload).order_by(Upload.id.desc())).all()
    return [{"id": u.id, "filename": u.filename, "added": u.added, "updated": u.updated, "skipped": u.skipped,
             "created_at": u.created_at.isoformat() if u.created_at else None, "file_report": u.file_report} for u in rows]


@router.post("/records")
def add_day(body: NewDay, db: Session = Depends(get_db)):
    try:
        warnings = svc.create_record(db, get_store(db), body.date, body.model_dump(exclude={"date"}))
    except ValueError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "warnings": warnings}


@router.put("/records/{d}")
def edit_day(d: date, body: DayValues, db: Session = Depends(get_db)):
    try:
        warnings = svc.update_record(db, get_store(db), d, body.model_dump())
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {"ok": True, "warnings": warnings}


@router.delete("/records/{d}")
def delete_day(d: date, db: Session = Depends(get_db)):
    try:
        warnings = svc.delete_record(db, get_store(db), d)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {"ok": True, "warnings": warnings}


@router.get("/records/{d}/history")
def history(d: date, db: Session = Depends(get_db)):
    rows = db.scalars(select(RecordChange).where(RecordChange.date == d).order_by(RecordChange.id.desc())).all()
    return [{"action": c.action, "source": c.source, "old": c.old_values, "new": c.new_values,
             "at": c.created_at.isoformat() if c.created_at else None} for c in rows]
