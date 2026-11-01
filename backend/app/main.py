import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .config import settings
from .db import Base, SessionLocal, engine, wait_for_db
from .models import Dataset
from .routers import analysis, anomalies, datasets, exports, predictions
from .services import anomaly, ml
from .services.demo import generate_demo_data
from .services.preprocess import build_quality_report, clean, read_upload
from .services.repository import save_dataset

log = logging.getLogger("uvicorn")


def seed_initial_data() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Dataset)):
            return
        if os.path.exists(settings.seed_file):
            log.info("No datasets found - importing %s", settings.seed_file)
            with open(settings.seed_file, "rb") as f:
                df, report = clean(read_upload(settings.seed_file, f.read()))
            ds = save_dataset(db, settings.seed_name, df, report, source="upload")
        elif settings.seed_demo_data:
            log.info("No datasets found - seeding synthetic demo data")
            df = generate_demo_data()
            ds = save_dataset(db, "Demo (synthetic) dataset", df, build_quality_report(df), source="demo")
        else:
            return
        ml.train_all(db, ds.id, df)
        anomaly.detect_all(db, ds.id, df)


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_db()
    Base.metadata.create_all(engine)
    seed_initial_data()
    yield


app = FastAPI(title="Groundwater Quality Prediction & Anomaly Detection API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (datasets.router, analysis.router, predictions.router, anomalies.router, exports.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
