# System Testing (Objective 5)

Two layers: automated backend tests (pytest) and functional UI test cases.

## 1. Automated tests

Run:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Tests use an isolated SQLite database and the real seed file. Last run: **26 passed**.

| File | Test | What it checks |
|---|---|---|
| test_preprocess.py | test_reads_plant_docx_table | Word table is read: 61 rows, Chinese header |
| | test_maps_chinese_plant_headers | All 7 Chinese plant headers map to canonical variables |
| | test_maps_english_headers_with_units | English headers with units map; extra columns ignored |
| | test_real_data_values_preserved | Date range, completeness, exact values (e.g. 09-16 dosage 1.0, chlorine 0.05) |
| | test_comma_decimal_typo_corrected_and_reported | `7,58` → 7.58 and listed in the report |
| | test_dotted_dates_duplicates_and_sorting | `2026.8.1` dates parsed, duplicate date removed (first kept), sorted |
| | test_invalid_dates_and_non_numeric_values | Invalid dates dropped; non-numeric → missing and counted |
| | test_missing_date_column_rejected | File without a date column is rejected |
| test_models.py | test_target_is_next_calendar_day_value | Target is exactly the next day's value (60 pairs) |
| | test_gaps_do_not_create_pairs | A missing day does not create a false t → t+1 pair |
| | test_persistence_and_mean_references | Reference predictions are computed correctly |
| | test_time_series_cv_is_expanding_and_ordered | CV folds are chronological with growing training sets |
| test_api.py | test_seeded_with_real_dataset | Empty DB is seeded with the 61-day real dataset |
| | test_records_match_source | API returns source values |
| | test_chronological_split_without_overlap | 48/12 split; test period 09-19 – 09-30 |
| | test_all_models_and_references_trained | 3 targets × 4 models |
| | test_anomaly_rerun_persists_parameters_and_bounds | Re-run with k = 2.0 stores and returns the parameters and bounds used |
| | test_known_low_dosage_days_flagged_by_both_methods | 2026-09-16 flagged by IQR and Isolation Forest |
| | test_value_on_iqr_bound_not_flagged_for_that_variable | Value equal to a bound is not flagged (float tolerance) |
| | test_eda_endpoints | Correlation (dosage–chlorine > 0.95), histogram, invalid variable → 400 |
| | test_exports | 4 CSV exports return the expected rows |
| | test_upload_rejects_bad_files | Wrong extension → 400; no date column → 422 |
| | test_upload_new_dataset_becomes_active_and_delete | Upload becomes active; delete restores previous dataset |
| | test_dashboard_summary | Summary: 61 rows, top correlation > 0.95, free chlorine within reference 56/61, turbidity −31%, anomaly counts |
| | test_dashboard_day_view | Day view for 09-16 (low dosage, both flags, prev/next, ±3 days), test-period day has predictions, unknown date → 404, first day has no prev |
| | test_duplicate_dates_warned_on_upload | Duplicate date in upload is listed in the report and returned as a warning |

## 2. Functional UI test cases

Environment: `docker compose up -d --build`, Chrome-based browser at 1440 × 1000, http://localhost:8080.
"Pass" = observed during development on 2026-11-01. "To run" = not yet executed manually; run before submission
and fill in the result.

| ID | Page | Steps | Expected result | Result |
|---|---|---|---|---|
| UI-01 | Dashboard | Open `/` | Summary cards: 61 records, 100% quality, predictability 0/3, 3 records to review; findings: turbidity −31.2%, dosage × chlorine r = 0.98, free chlorine within reference 56/61 | Pass |
| UI-02 | Dashboard | Open `/` without a date | Daily review defaults to the last record (2026-09-30), not today's date | Pass |
| UI-03 | Dashboard | Open `/?date=2026-09-16` | Calendar highlights 16 Sep; dosage 1.00 and free chlorine 0.05 marked Low; IQR and Isolation Forest reasons shown; ±3-day chart with IQR bounds | Pass |
| UI-03b | Dashboard | Open `/?date=2026-09-27` (test period) | "Model check for this day" table shows actual vs LR, RF and historical mean | Pass |
| UI-03c | Dashboard | Click Next / Prev | Moves to the adjacent record date and updates the URL | Pass (Next) |
| UI-03d | Dashboard | Click a flagged date in the calendar | Day view switches to that date | To run |
| UI-03e | Anomaly Detection | Click "Day" on a flagged row | Opens Dashboard daily review for that date | Pass |
| UI-04 | Historical Trends | Select variable, switch 1W/2W/1M/All | Line chart and 7-day average update to the selected range | Pass (All) / To run (others) |
| UI-05 | Historical Trends | Switch Influent vs Outlet between Turbidity and pH | Weekly bars for the selected pair | Pass |
| UI-06 | Historical Trends | Toggle Distribution: Histogram / Box plot | Box plot shows quartiles; IQR outliers drawn as points | Pass |
| UI-07 | Historical Trends | Switch correlation Pearson / Spearman | Heatmap values change; dosage × free chlorine ≈ 0.98 (Pearson) | Pass (Pearson) |
| UI-08 | Historical Trends | Change scatter X/Y | Points and trend line update | To run |
| UI-09 | Next-day Prediction | Switch target; toggle series incl. references | Metric cards, line chart, scatter, residuals update; small-test-set warning shown | Pass |
| UI-10 | Anomaly Detection | Open page | Counts IQR 13, Isolation Forest 3, both 3; subtitle shows k = 1.5, contamination = 0.05 | Pass |
| UI-11 | Anomaly Detection | Set k = 2.0, click Re-run detection | Counts change; timeline bounds and subtitle reflect k = 2.0 | To run (API covered by test) |
| UI-12 | Anomaly Detection | Filter "Both", click View on 2026-09-16 | Modal shows dosage 1.0 and free chlorine 0.05 with bounds (IQR) and z-scores (IF) | To run |
| UI-13 | Model Evaluation | Open page | Table lists 4 models per target with test and CV metrics; interpretation notice | Pass |
| UI-14 | Model Evaluation | Click Export CSV | `model_evaluation.csv` downloads | To run (API covered by test) |
| UI-15 | Data Management | Open page | Quality report: 61 rows, 100% completeness, correction note for 2026-08-07 | Pass |
| UI-16 | Data Management | Drag the seed .docx into the upload box | Upload succeeds, new dataset becomes Active, pages refresh | To run (API covered by test) |
| UI-17 | Data Management | Upload a .txt file | Error message shown, no dataset created | To run (API covered by test) |
| UI-18 | Data Management | Click each export button | 4 CSV files download and open in Excel with correct characters | To run |
| UI-19 | Deployment | `docker compose down -v && docker compose up -d --build` on a clean machine | All three containers start; real dataset imported automatically | Pass |
