"""Synthetic groundwater treatment data for development before the real dataset is loaded.

The numbers are invented and only roughly plausible; never report results computed on them.
"""

import numpy as np
import pandas as pd


def generate_demo_data(days: int = 420, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-01-01", periods=days, freq="D")
    t = np.arange(days)
    season = np.sin(2 * np.pi * t / 365)

    influent_turbidity = np.clip(4 + 1.8 * season + rng.normal(0, 0.8, days), 0.5, None)
    influent_ph = 7.0 + 0.15 * season + rng.normal(0, 0.12, days)
    naocl_dosage = np.clip(1.6 + 0.18 * influent_turbidity + rng.normal(0, 0.15, days), 0.5, None)

    outlet_turbidity = np.empty(days)
    outlet_ph = np.empty(days)
    outlet_cl = np.empty(days)
    outlet_turbidity[0], outlet_ph[0], outlet_cl[0] = 0.4, 7.4, 0.8
    for i in range(1, days):
        # Mild autocorrelation so next-day prediction has some signal to find.
        outlet_turbidity[i] = 0.5 * outlet_turbidity[i - 1] + 0.05 * influent_turbidity[i] + rng.normal(0, 0.05)
        outlet_ph[i] = 0.6 * outlet_ph[i - 1] + 0.4 * (influent_ph[i] + 0.35) + rng.normal(0, 0.05)
        outlet_cl[i] = 0.4 * outlet_cl[i - 1] + 0.35 * naocl_dosage[i] - 0.05 * influent_turbidity[i] + rng.normal(0, 0.06)

    df = pd.DataFrame(
        {
            "date": dates,
            "influent_turbidity": influent_turbidity,
            "influent_ph": influent_ph,
            "naocl_dosage": naocl_dosage,
            "outlet_turbidity": np.clip(outlet_turbidity, 0.05, None),
            "outlet_ph": outlet_ph,
            "outlet_free_chlorine": np.clip(outlet_cl, 0.05, None),
        }
    )

    # Inject a handful of unusual days.
    for idx, col, factor in [(60, "influent_turbidity", 3.0), (145, "outlet_free_chlorine", 2.2),
                             (210, "outlet_ph", 1.12), (290, "naocl_dosage", 1.9), (350, "outlet_turbidity", 3.5)]:
        if idx < days:
            df.loc[idx, col] *= factor
    # And some missing values.
    for idx, col in [(30, "influent_ph"), (31, "influent_ph"), (180, "outlet_free_chlorine"), (260, "naocl_dosage")]:
        if idx < days:
            df.loc[idx, col] = np.nan

    num_cols = df.columns[1:]
    df[num_cols] = df[num_cols].round(3)
    return df
