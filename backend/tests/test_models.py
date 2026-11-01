"""Prediction setup (proposal objective 2): next-day alignment, no leakage, references, CV."""

import pandas as pd

from app.services.ml import build_supervised, cross_validate, _fit_predict
from app.services.preprocess import clean, read_upload


def _real(seed_bytes):
    df, _ = clean(read_upload("plant.docx", seed_bytes))
    return df


def test_target_is_next_calendar_day_value(seed_bytes):
    df = _real(seed_bytes)
    sup = build_supervised(df, "outlet_free_chlorine")
    assert len(sup) == 60
    assert ((sup["target_date"] - sup.index) == pd.Timedelta(days=1)).all()
    by_date = df.set_index("date")["outlet_free_chlorine"]
    assert (sup["target"].values == by_date.loc[sup["target_date"]].values).all()


def test_gaps_do_not_create_pairs(seed_bytes):
    df = _real(seed_bytes)
    df = df[df["date"] != "2026-08-10"]
    sup = build_supervised(df, "outlet_ph")
    assert pd.Timestamp("2026-08-09") not in sup.index  # 08-09 -> 08-11 is not a next-day pair
    assert len(sup) == 58


def test_persistence_and_mean_references(seed_bytes):
    sup = build_supervised(_real(seed_bytes), "outlet_ph")
    train, test = sup.iloc[:48], sup.iloc[48:]
    pers, _ = _fit_predict("persistence", "outlet_ph", train, test)
    assert (pers == test["outlet_ph"].values).all()
    mean, _ = _fit_predict("historical_mean", "outlet_ph", train, test)
    assert (mean == train["target"].mean()).all()


def test_time_series_cv_is_expanding_and_ordered(seed_bytes):
    sup = build_supervised(_real(seed_bytes), "outlet_turbidity")
    cv = cross_validate(sup, "outlet_turbidity", "linear_regression")
    sizes = [f["train_size"] for f in cv["folds"]]
    starts = [f["test_start"] for f in cv["folds"]]
    assert cv["n_splits"] == 5 and sizes == sorted(sizes) and starts == sorted(starts)
