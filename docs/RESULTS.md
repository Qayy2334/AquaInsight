# Results, Discussion and Limitations

Material for the Final Report. All numbers are produced by the system on the real dataset and can be
regenerated from the dashboard (Data Management → Export CSV) or `docker compose up` on an empty database.

## 1. Dataset

| Item | Value |
|---|---|
| Source | 地下水厂 土门 daily treatment log (Word table), `backend/seed_data/tumen_groundwater_2026-08_09.docx` |
| Period | 2026-08-01 – 2026-09-30 |
| Records | 61 days, no missing days, no missing values, no duplicate dates |
| Variables | influent turbidity (NTU), influent pH, NaOCl dosage (mg/千吨水, shown as mg/kt), outlet turbidity (NTU), outlet pH, outlet free chlorine (mg/L) |
| Corrections | 1 value: outlet pH on 2026-08-07 recorded as `7,58`, interpreted as a decimal-comma typo → 7.58 (reported in the quality report) |

**Deviation from the proposal.** The proposal anticipated "more than one year" of records; the available dataset covers
two months. This limits every modelling result below.

## 2. Exploratory data analysis (Objective 1)

| Variable | Mean | SD | Min | Median | Max |
|---|---|---|---|---|---|
| Influent turbidity (NTU) | 0.230 | 0.077 | 0.14 | 0.21 | 0.51 |
| Influent pH | 7.489 | 0.043 | 7.40 | 7.49 | 7.61 |
| NaOCl dosage (mg/kt) | 3.661 | 0.802 | 1.0 | 4.0 | 5.0 |
| Outlet turbidity (NTU) | 0.159 | 0.065 | 0.08 | 0.13 | 0.35 |
| Outlet pH | 7.541 | 0.043 | 7.45 | 7.55 | 7.65 |
| Outlet free chlorine (mg/L) | 0.320 | 0.079 | 0.05 | 0.35 | 0.45 |

Findings:

1. **Turbidity is reduced by treatment.** Mean outlet turbidity (0.159 NTU) is about 31% lower than influent (0.230 NTU);
   outlet exceeded influent on 8 of 61 days.
2. **pH rises slightly** from influent (7.49) to outlet (7.54); both stay in a narrow band (SD ≈ 0.04).
3. **Free chlorine tracks dosage almost exactly** (Pearson r = 0.98). On 40 of 61 days outlet free chlorine equals
   `0.1 × dosage − 0.05` to two decimals. This suggests free chlorine may be recorded or estimated from dosage rather than
   measured independently; it should be confirmed with the plant before drawing process conclusions.
4. **Other relationships are weak** (|r| ≤ 0.33), e.g. influent vs outlet turbidity r = 0.33.
5. **Low-dosage episode 16–18 September** (dosage 1.0 / 1.2 / 1.6) with free chlorine 0.05 / 0.10 / 0.15 mg/L, below the
   0.2 mg/L residual commonly targeted.

## 3. Next-day prediction (Objectives 2 and 5)

Setup: inputs = six measurements on day *t*; target = outlet indicator on day *t+1*; only true consecutive-day pairs
(60 pairs). Hold-out: chronological 80/20 → 48 training / 12 test days (test targets 2026-09-19 – 09-30).
Time-series CV: 5 expanding-window folds (each fold trains on all earlier days).
Two naive references are included to interpret the scores: **Persistence** (tomorrow = today) and
**Historical Mean** (tomorrow = training mean).

| Target | Model | Test MAE | Test RMSE | Test R² | CV MAE (mean ± sd) |
|---|---|---|---|---|---|
| Outlet turbidity | Linear Regression | 0.0421 | 0.0605 | 0.066 | 0.0977 ± 0.0671 |
| | Random Forest | 0.0492 | 0.0629 | −0.008 | 0.0532 ± 0.0083 |
| | Persistence (ref.) | 0.0642 | 0.0904 | −1.083 | 0.0584 ± 0.0171 |
| | Historical Mean (ref.) | 0.0459 | 0.0627 | −0.002 | **0.0517 ± 0.0050** |
| Outlet pH | Linear Regression | 0.0344 | 0.0382 | −0.386 | 0.0669 ± 0.0679 |
| | Random Forest | 0.0346 | 0.0388 | −0.429 | 0.0402 ± 0.0076 |
| | Persistence (ref.) | 0.0433 | 0.0474 | −1.132 | 0.0400 ± 0.0076 |
| | Historical Mean (ref.) | 0.0283 | 0.0327 | −0.011 | **0.0379 ± 0.0116** |
| Outlet free chlorine | Linear Regression | 0.0557 | 0.0723 | −0.036 | 0.0826 ± 0.0408 |
| | Random Forest | 0.0569 | 0.0836 | −0.384 | 0.0631 ± 0.0233 |
| | Persistence (ref.) | 0.0833 | 0.1041 | −1.144 | 0.0750 ± 0.0182 |
| | Historical Mean (ref.) | 0.0542 | 0.0718 | −0.021 | **0.0589 ± 0.0167** |

Discussion:

- On the 12-day hold-out, Linear Regression has a lower MAE than Random Forest for all three targets, but the margins are
  small and R² is ≤ 0.07 for every model.
- Under cross-validation, **neither model beats the Historical Mean reference for any target.** Random Forest is the more
  stable of the two (smaller CV spread); Linear Regression degrades sharply on early folds with little training data.
- Persistence has the highest hold-out error (R² ≈ −1.1), so day-to-day values are not simply carried over; under CV,
  Linear Regression is the least stable model.
- Answer to the proposal's question "can the recorded variables predict next-day outlet quality?": **with 60 day-pairs,
  no useful next-day predictive signal was found.** Plausible reasons: very short record, outlet indicators varying in a
  narrow band, dosage being an operator decision on the day (not knowable a day ahead), and free chlorine possibly
  derived from dosage.
- Feature influence (Random Forest, free chlorine): the model relies mainly on the current day's values, which is
  consistent with the weak signal above. Feature influence is not causal.

## 4. Anomaly detection (Objectives 3 and 5)

Parameters: IQR k = 1.5 on raw values; Isolation Forest (300 trees, contamination 0.05) on standardized variables.
Result: **IQR flagged 13 days, Isolation Forest 3 days; all 3 Isolation Forest days are also flagged by IQR.**

Review of records flagged by both methods:

| Date | Main variables | Interpretation |
|---|---|---|
| 2026-08-19 | influent turbidity 0.42 (z +2.46), outlet turbidity 0.35 (z +2.93), outlet pH 7.45 (z −2.12), free chlorine 0.45 | Highest turbidity of the period on both sides of treatment together with low outlet pH; reasonable to review against plant operating notes |
| 2026-09-16 | dosage 1.0 (z −3.32), free chlorine 0.05 (z −3.43) | Lowest dosage and residual of the period; part of the 16–18 Sep low-dosage episode |
| 2026-09-17 | dosage 1.2 (z −3.07), free chlorine 0.10 (z −2.79) | Same episode |

IQR-only days (10):

| Pattern | Dates |
|---|---|
| Outlet turbidity high (0.32–0.33 NTU, bound 0.295) | 08-03, 09-11, 09-23 |
| Influent turbidity high (0.51 NTU, bound 0.395) | 08-10 |
| Free chlorine high (0.45 mg/L, bound 0.425) | 08-22, 09-07 |
| Low dosage with low free chlorine (dosage 1.6–2.5, chlorine 0.15–0.20) | 08-05, 09-18, 09-27, 09-28 |

Observations:

- Because dosage and free chlorine move together, most IQR flags come in dosage/chlorine pairs. The two methods agree on
  the most extreme multi-variable days, while IQR additionally surfaces mild single-variable extremes.
- Without confirmed labels, these are **potential anomalies for review**, not evidence of unsafe water or treatment
  failure. The 16–18 September episode is the clearest candidate for follow-up with the plant.
- A boundary issue was found during testing: a value exactly on the IQR bound (e.g. dosage 5.0 vs bound 4.1 + 1.5 × 0.6)
  was flagged due to floating-point error; a tolerance was added (covered by an automated test).

## 5. Limitations

1. **Small sample:** 61 days (12-day hold-out, CV test folds of 10 days). All metrics have high uncertainty.
2. **Short time span:** two months cannot capture seasonal variation the proposal intended to study.
3. **Possible derived variable:** free chlorine appears to follow `0.1 × dosage − 0.05` on most days.
4. **No anomaly ground truth:** anomaly results are evaluated for reasonableness only, as planned in the proposal.
5. **Unit:** dosage is recorded as mg/千吨水; its absolute scale was not verified with the plant.
6. **Scope:** historical analysis only; the system is not a real-time monitor and does not assess water safety.

## 6. Deviations from the proposal

| Proposal | Implemented | Reason |
|---|---|---|
| Python + Streamlit dashboard | React + TypeScript frontend, FastAPI backend, MySQL, Docker Compose | Custom multi-page UI based on the SmartyAir Figma kit; persistent storage of datasets and results; reproducible deployment |
| > 1 year of records | 61 days | Data available from the plant |
| LR baseline vs RF | Plus Persistence / Historical Mean references and 5-fold time-series CV | Needed to interpret near-zero/negative R² on a small test set |
