from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Dataset
from ..services import anomaly, ml
from ..services.preprocess import clean, read_upload
from ..services.repository import save_dataset

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _serialize(ds: Dataset) -> dict:
    return {"id": ds.id, "name": ds.name, "source": ds.source, "row_count": ds.row_count,
            "created_at": ds.created_at.isoformat() if ds.created_at else None, "quality_report": ds.quality_report}


@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    return [_serialize(d) for d in db.scalars(select(Dataset).order_by(Dataset.id.desc())).all()]


@router.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls", ".csv", ".docx")):
        raise HTTPException(400, "Please upload an .xlsx, .xls, .csv or .docx file.")
    content = await file.read()
    try:
        df, report = clean(read_upload(file.filename, content))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # unreadable spreadsheet
        raise HTTPException(422, f"Could not read file: {e}")
    if df.empty:
        raise HTTPException(422, "No valid rows found after cleaning.")

    ds = save_dataset(db, file.filename, df, report)
    # Run the analysis pipeline right away so every page has results for the new dataset.
    warnings = []
    if report.get("duplicate_dates"):
        dd = report["duplicate_dates"]
        warnings.append(f"{len(dd)} date(s) had more than one row; only the first row was kept: "
                        + ", ".join(dd[:10]) + (" …" if len(dd) > 10 else ""))
    try:
        ml.train_all(db, ds.id, df)
    except ValueError as e:
        warnings.append(str(e))
    anomaly.detect_all(db, ds.id, df)
    return {**_serialize(ds), "warnings": warnings}


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(404, "Dataset not found")
    db.delete(ds)
    db.commit()
    return {"ok": True}
