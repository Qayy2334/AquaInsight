"""Next-day outlet quality prediction (proposal objective 2).

Features: the six measurements on day t. Target: an outlet indicator on day t+1.
Split is chronological (earlier → train, later → test) so no future information leaks into training.

Besides the two proposal models (Linear Regression baseline, Random Forest), two naive references are
reported to help interpret the scores: "persistence" (tomorrow = today) and "historical mean"
(tomorrow = training-period mean). A model that cannot beat these has not learned useful structure.
"""

import os
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import ModelRun, Prediction
from .preprocess import prepare_for_analysis
from .variables import TARGETS, VARIABLE_KEYS

MODEL_TYPES = {
    "linear_regression": lambda: make_pipeline(StandardScaler(), LinearRegression()),
    "random_forest": lambda: RandomForestRegressor(n_estimators=300, max_depth=8, random_state=42, n_jobs=-1),
}
REFERENCE_TYPES = ("persistence", "historical_mean")
CV_SPLITS = 5


def build_supervised(df: pd.DataFrame, target: str) -> pd.DataFrame:
    data = prepare_for_analysis(df).set_index("date")
    sup = data[VARIABLE_KEYS].copy()
    sup["target"] = data[target].shift(-1)
    sup["target_date"] = pd.Series(data.index, index=data.index).shift(-1)
    # Only keep pairs where t+1 really is the next calendar day.
    sup = sup[(sup["target_date"] - sup.index) == timedelta(days=1)]
    return sup.dropna()


def _artifact_path(dataset_id: int, model_type: str, target: str) -> str:
    os.makedirs(settings.model_dir, exist_ok=True)
    return os.path.join(settings.model_dir, f"ds{dataset_id}_{model_type}_{target}.joblib")


def _fit_predict(model_type: str, target: str, train: pd.DataFrame, test: pd.DataFrame):
    """Return (predictions, fitted model or None)."""
    if model_type == "persistence":
        return test[target].to_numpy(), None
    if model_type == "historical_mean":
        return np.full(len(test), train["target"].mean()), None
    model = MODEL_TYPES[model_type]()
    model.fit(train[VARIABLE_KEYS], train["target"])
    return model.predict(test[VARIABLE_KEYS]), model


def _scores(y_true, y_pred) -> dict:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)) if len(y_true) > 1 else float("nan"),
    }


def cross_validate(sup: pd.DataFrame, target: str, model_type: str, n_splits: int = CV_SPLITS) -> dict:
    """Expanding-window time-series CV: each fold trains on all earlier days and tests on the next block."""
    folds = []
    for train_idx, test_idx in TimeSeriesSplit(n_splits=n_splits).split(sup):
        train, test = sup.iloc[train_idx], sup.iloc[test_idx]
        pred, _ = _fit_predict(model_type, target, train, test)
        s = _scores(test["target"], pred)
        folds.append({"train_size": len(train), "test_size": len(test),
                      "test_start": test["target_date"].iloc[0].date().isoformat(), "mae": s["mae"], "rmse": s["rmse"]})
    maes = [f["mae"] for f in folds]
    rmses = [f["rmse"] for f in folds]
    return {"n_splits": n_splits, "mae_mean": float(np.mean(maes)), "mae_std": float(np.std(maes)),
            "rmse_mean": float(np.mean(rmses)), "rmse_std": float(np.std(rmses)), "folds": folds}


def train_all(db: Session, dataset_id: int, df: pd.DataFrame) -> list[ModelRun]:
    db.execute(delete(ModelRun).where(ModelRun.dataset_id == dataset_id))
    runs: list[ModelRun] = []
    for target in TARGETS:
        sup = build_supervised(df, target)
        if len(sup) < 30:
            raise ValueError(f"Not enough consecutive-day records to train for {target} ({len(sup)}).")
        split = int(len(sup) * (1 - settings.test_ratio))
        train, test = sup.iloc[:split], sup.iloc[split:]
        for model_type in (*MODEL_TYPES, *REFERENCE_TYPES):
            pred, model = _fit_predict(model_type, target, train, test)

            importance = None
            path = None
            if model is not None:
                if model_type == "random_forest":
                    importance = dict(zip(VARIABLE_KEYS, map(float, model.feature_importances_)))
                else:
                    importance = dict(zip(VARIABLE_KEYS, map(float, model[-1].coef_)))  # standardized coefficients
                path = _artifact_path(dataset_id, model_type, target)
                joblib.dump(model, path)

            run = ModelRun(
                dataset_id=dataset_id,
                model_type=model_type,
                target=target,
                **_scores(test["target"], pred),
                train_size=len(train),
                test_size=len(test),
                feature_importance=importance,
                cv=cross_validate(sup, target, model_type),
                artifact_path=path,
            )
            run.predictions = [
                Prediction(date=d.date(), actual=float(a), predicted=float(p))
                for d, a, p in zip(test["target_date"], test["target"], pred)
            ]
            db.add(run)
            runs.append(run)
    db.commit()
    return runs


def predict_next_day(db: Session, dataset_id: int, df: pd.DataFrame) -> dict:
    """Forecast the day after the last record for each outlet target.

    The recommended model per target is the ML model (LR or RF) with the lower cross-validated MAE.
    Reliability is "usable" only if that model beats the historical-mean reference on CV MAE.
    """
    data = prepare_for_analysis(df)
    last = data.iloc[[-1]]
    base_date = last["date"].iloc[0]
    runs = db.scalars(select(ModelRun).where(ModelRun.dataset_id == dataset_id)).all()

    forecasts = {}
    for target in TARGETS:
        by_type = {r.model_type: r for r in runs if r.target == target}
        models = {}
        for mt in MODEL_TYPES:
            run = by_type.get(mt)
            if not run or not run.artifact_path or not os.path.exists(run.artifact_path):
                continue
            model = joblib.load(run.artifact_path)
            models[mt] = {
                "value": float(model.predict(last[VARIABLE_KEYS])[0]),
                "test_mae": run.mae,
                "cv_mae": (run.cv or {}).get("mae_mean"),
            }
        if not models:
            continue
        rec = min(models, key=lambda mt: models[mt]["cv_mae"] if models[mt]["cv_mae"] is not None else float("inf"))
        mean_run = by_type.get("historical_mean")
        mean_cv = (mean_run.cv or {}).get("mae_mean") if mean_run else None
        rec_cv = models[rec]["cv_mae"]
        forecasts[target] = {
            "recommended_model": rec,
            "value": models[rec]["value"],
            "error": rec_cv,  # typical absolute error (CV MAE) used as the ± range
            "current": float(last[target].iloc[0]),
            "reliability": "usable" if rec_cv is not None and mean_cv is not None and rec_cv < mean_cv else "limited",
            "mean_cv_mae": mean_cv,
            "models": models,
        }
    return {
        "based_on": base_date.date().isoformat(),
        "for_date": (base_date + timedelta(days=1)).date().isoformat(),
        "forecasts": forecasts,
    }
