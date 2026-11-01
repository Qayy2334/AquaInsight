# System Testing (Objective 5)

Two layers: automated backend tests (pytest) and functional UI test cases.

## 1. Automated tests

Run:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Tests use an isolated SQLite database and the real seed file. Last run: **34 passed**.

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
| test_auth.py | test_protected_endpoints_require_sign_in | Data endpoints return 401 without a valid token; health stays public |
| | test_register_login_and_me | Register, sign in, /me and an authorised data request |
| | test_register_validation | Duplicate username 409; short username, short password, invalid characters 422 |
| | test_wrong_credentials_rejected | Wrong password and unknown user both 401 |
| | test_password_not_stored_in_plain_text | Stored value is a bcrypt hash |
| test_api.py | test_seeded_from_plant_log | Empty DB is seeded with the 61-day plant log; import logged |
| | test_records_match_source_and_carry_origin | API returns source values and each day's origin |
| | test_chronological_split_without_overlap | 48/12 split; test period 09-19 – 09-30 |
| | test_all_models_and_references_trained | 3 targets × 4 models |
| | test_anomaly_rerun_persists_parameters_and_bounds | Re-run with k = 2.0 stores and returns the parameters and bounds used |
| | test_known_low_dosage_days_flagged_by_both_methods | 2026-09-16 flagged by IQR and Isolation Forest |
| | test_value_on_iqr_bound_not_flagged_for_that_variable | Value equal to a bound is not flagged (float tolerance) |
| | test_eda_endpoints | Correlation (dosage–chlorine > 0.95), histogram, invalid variable → 400 |
| | test_exports | 4 CSV exports return the expected rows |
| | test_dashboard_day_view | Day view for 09-16, test-period day has predictions, unknown date → 404, first day has no prev |
| | test_next_day_forecast | Forecast for 2026-10-01: recommended model has the lowest CV MAE, ± = CV MAE, all "limited" |
| | test_upload_rejects_bad_files | Wrong extension → 400; no date column → 422 |
| | test_preview_of_same_file_changes_nothing | Re-uploading the plant log: 0 new, 0 conflicts, 61 identical; nothing written |
| | test_preview_reports_duplicate_dates_in_file | Repeated date inside a file is reported |
| | test_merge_upload_new_day_and_conflict | New day added; conflicting day kept unless ticked, then replaced and logged; analysis re-runs; restored |
| | test_manual_add_edit_delete_with_history | Add (409 on duplicate), edit, delete (404 on missing), history newest first |
| | test_commit_warns_about_duplicate_dates | Import returns a warning listing repeated dates |

## 2. Functional UI test cases

Environment: `docker compose up -d --build`, Chrome-based browser at 1440 × 1000, http://localhost:8080.
"Pass" = observed during development on 2026-11-01. "To run" = not yet executed manually; run before submission
and fill in the result.

| ID | Page | Steps | Expected result | Result |
|---|---|---|---|---|
| UI-01 | Dashboard | Open `/` | Single-day view of the last record 2026-09-30 (not today's date); "No flags"; Next disabled; Day 61 of 61 | Pass |
| UI-02 | Dashboard | Click the date button, pick 19 Aug in the calendar popover | Popover closes, URL becomes `?date=2026-08-19`, status "Flagged by both methods" | Pass |
| UI-03 | Dashboard | Open `/?date=2026-09-16` | KPI cards: free chlorine 0.05 and dosage 1.00 marked Low with change vs previous day; gauge pointer in the amber (low) zone; Alert Information lists IQR and Isolation Forest reasons | Pass |
| UI-03b | Dashboard | Change gauge indicator | Dial range, normal band, value and badge update for the selected variable | To run |
| UI-03c | Dashboard | Open a test-period date (e.g. 2026-09-27), scroll to Model Check | Actual vs LR, RF and historical mean with errors | Pass |
| UI-03d | Dashboard | Click Prev / Next | Moves to the adjacent record date | To run |
| UI-03e | Anomaly Detection | Click "Day" on a flagged row | Opens the Dashboard for that date | Pass |
| UI-04 | Historical Trends | Select variable, switch 1W/2W/1M/All | Line chart and 7-day average update to the selected range | Pass (All) / To run (others) |
| UI-05 | Historical Trends | Switch Influent vs Outlet between Turbidity and pH | Weekly bars for the selected pair | Pass |
| UI-06 | Historical Trends | Toggle Distribution: Histogram / Box plot | Box plot shows quartiles; IQR outliers drawn as points | Pass |
| UI-07 | Historical Trends | Switch correlation Pearson / Spearman | Heatmap values change; dosage × free chlorine ≈ 0.98 (Pearson) | Pass (Pearson) |
| UI-08 | Historical Trends | Change scatter X/Y | Points and trend line update | To run |
| UI-09 | Next-day Prediction | Open page | Only forecast content: cards for 2026-10-01 (recommended model, value ± typical error, change vs last record, normal-range check, "Limited accuracy"), limited-accuracy notice with link to Model Testing, and the six input measurements of 2026-09-30 | Pass |
| UI-09b | Model Testing | Open page; switch target; toggle series | Conclusion (model used, CV error vs historical average), LR/RF test MAE/RMSE cards, actual vs predicted, predicted-vs-actual scatter, residuals and test log update per target | Pass (open) / To run (switch, toggle) |
| UI-10 | Anomaly Detection | Open page | Counts IQR 13, Isolation Forest 3, both 3; subtitle shows k = 1.5, contamination = 0.05 | Pass |
| UI-11 | Anomaly Detection | Set k = 2.0, click Re-run detection | Counts change; timeline bounds and subtitle reflect k = 2.0 | To run (API covered by test) |
| UI-12 | Anomaly Detection | Filter "Both", click View on 2026-09-16 | Modal shows dosage 1.0 and free chlorine 0.05 with bounds (IQR) and z-scores (IF) | To run |
| UI-13 | Model Evaluation | Open page | Table lists 4 models per target with test and CV metrics; interpretation notice | Pass |
| UI-14 | Model Evaluation | Click Export CSV | `model_evaluation.csv` downloads | To run (API covered by test) |
| UI-15 | Data Management | Open page | Summary (61 days, range, 0 missing, 100%), import box, import history (plant log +61), exports, full-width daily records table with source and actions | Pass |
| UI-16 | Data Management | Choose a CSV with one new day and one changed day | Preview: 1 new, 1 different (old → new shown), 0 identical; import without ticking adds the new day and keeps the old value | Pass |
| UI-16b | Data Management | Import again and tick the conflicting day | Day replaced; history shows the update | To run (API covered by test) |
| UI-17 | Data Management | Delete a day | Day becomes a "No record for this day" row; missing count +1; analysis re-runs | Pass |
| UI-17b | Data Management | Click "Add" on the missing row, fill values, save | Day restored as Manual; history shows delete then create | Pass |
| UI-17c | Data Management | Edit a day | Value updated, source becomes Manual | Pass |
| UI-18 | Data Management | Click each export button | 4 CSV files download and open in Excel with correct characters | To run |
| UI-20 | Sign in | Open any page while signed out | Redirected to Sign In (split layout from Figma, brand panel on the left) | Pass |
| UI-21 | Sign in | Unknown username or wrong password | Red message under the password field: "Incorrect username or password." | Pass |
| UI-22 | Sign up | Submit with short username, short password and mismatched confirmation | Three field errors shown; nothing submitted | Pass |
| UI-23 | Sign up | Valid username and matching passwords | Account created, signed in, Dashboard shown with name in the header | Pass |
| UI-24 | Header | Click sign-out, then sign in again | Back to Sign In with session cleared; signing in returns to Dashboard | Pass |
| UI-25 | Session | Invalid or expired token | Next data request redirects to Sign In | Pass |
| UI-26 | Data Management | Click an export button while signed in | CSV downloads (request carries the token) | To run (authorised request verified) |
| UI-19 | Deployment | `docker compose down -v && docker compose up -d --build` on a clean machine | All three containers start; real dataset imported automatically | Pass |
