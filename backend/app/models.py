from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Dataset(Base):
    """The plant's record store. The app keeps a single store; daily records are merged into it."""

    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(32), default="upload")  # upload | demo
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    records: Mapped[list["WaterRecord"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class WaterRecord(Base):
    __tablename__ = "water_records"
    __table_args__ = (UniqueConstraint("dataset_id", "date", name="uq_dataset_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    influent_turbidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    influent_ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    naocl_dosage: Mapped[float | None] = mapped_column(Float, nullable=True)
    outlet_turbidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    outlet_ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    outlet_free_chlorine: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Where the current values came from: the upload id, or None for manual entry.
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    dataset: Mapped[Dataset] = relationship(back_populates="records")
    upload: Mapped["Upload | None"] = relationship()


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    model_type: Mapped[str] = mapped_column(String(32))  # linear_regression | random_forest | persistence | historical_mean
    target: Mapped[str] = mapped_column(String(64))
    mae: Mapped[float] = mapped_column(Float)
    rmse: Mapped[float] = mapped_column(Float)
    r2: Mapped[float] = mapped_column(Float)
    train_size: Mapped[int] = mapped_column(Integer)
    test_size: Mapped[int] = mapped_column(Integer)
    feature_importance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Time-series cross-validation summary: {"mae_mean", "mae_std", "rmse_mean", "rmse_std", "folds": [...]}
    cv: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)  # the day being predicted
    actual: Mapped[float] = mapped_column(Float)
    predicted: Mapped[float] = mapped_column(Float)

    run: Mapped[ModelRun] = relationship(back_populates="predictions")


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    method: Mapped[str] = mapped_column(String(32))  # iqr | iforest
    score: Mapped[float] = mapped_column(Float)
    # Variables that contributed to the flag, e.g. [{"variable": "outlet_ph", "value": 8.9, "z": 3.4}]
    contributors: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AnomalyRun(Base):
    """Parameters and IQR bounds of the latest detection run, so the UI shows what was actually used."""

    __tablename__ = "anomaly_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), unique=True)
    iqr_k: Mapped[float] = mapped_column(Float)
    contamination: Mapped[float] = mapped_column(Float)
    iqr_bounds: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Upload(Base):
    """One imported file and what it changed."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    added: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    file_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RecordChange(Base):
    """Audit trail for every create / update / delete of a daily record."""

    __tablename__ = "record_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    action: Mapped[str] = mapped_column(String(16))  # create | update | delete
    source: Mapped[str] = mapped_column(String(255))  # "upload: <filename>" | "manual"
    old_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
