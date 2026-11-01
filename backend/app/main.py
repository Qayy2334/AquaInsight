import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, SessionLocal, engine, wait_for_db
from .routers import analysis, anomalies, dashboard, exports, predictions, records as records_router
from .services import records
from .services.demo import generate_demo_data
from .services.preprocess import build_quality_report, clean, read_upload
from .services.repository import get_store

log = logging.getLogger("uvicorn")


def seed_initial_data() -> None:
    """Import the plant log (or demo data) when the record store is empty."""
    with SessionLocal() as db:
        store = get_store(db)
        if store.row_count:
            return
        if os.path.exists(settings.seed_file):
            log.info("No records found - importing %s", settings.seed_file)
            with open(settings.seed_file, "rb") as f:
                df, report = clean(read_upload(settings.seed_file, f.read()))
            records.commit_upload(db, store, df, os.path.basename(settings.seed_file), report, set())
        elif settings.seed_demo_data:
            log.info("No records found - seeding synthetic demo data")
            df = generate_demo_data()
            store.source = "demo"
            records.commit_upload(db, store, df, "synthetic demo data", build_quality_report(df), set())


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

for r in (records_router.router, analysis.router, predictions.router, anomalies.router, exports.router, dashboard.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
