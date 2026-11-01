# AquaInsight — Groundwater Quality Prediction & Anomaly Detection

CAT405 major project (Wu Bingying). A web dashboard over historical daily groundwater treatment records:
EDA, next-day outlet quality prediction (Linear Regression vs Random Forest), and anomaly detection (IQR vs Isolation Forest).
UI follows the SmartyAir Figma UI kit (design tokens in `frontend/src/index.css`).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS v4, ECharts, TanStack Query, React Router |
| Backend | FastAPI, SQLAlchemy 2, pandas, scikit-learn |
| Database | MySQL 8 |
| Deploy | Docker Compose (nginx serves the SPA and proxies `/api` to the backend) |

## Run with Docker

```bash
cp .env.example .env   # optional, defaults work
docker compose up -d --build
```

- Web: http://localhost:8080
- API docs (Swagger): http://localhost:8000/docs
- MySQL: `localhost:3307` (user `water` / `water`, db `water_quality`)

On first start (empty database) the backend imports the real plant log
`backend/seed_data/tumen_groundwater_2026-08_09.docx` (地下水厂 土门, 61 daily records, 2026-08-01 → 2026-09-30),
then trains the models and runs anomaly detection. Newer records can be uploaded in **Data Management**
(.xlsx / .xls / .csv / .docx); the newest dataset becomes active.
The synthetic generator (`SEED_DEMO_DATA=true`) is only used if the seed file is missing.

Notes on the real data: NaOCl dosage is recorded in **mg/千吨水 (mg/kt)**; one value `7,58` (outlet pH, 2026-08-07)
is auto-corrected to 7.58 and listed in the quality report.

Reset everything (including the database):

```bash
docker compose down -v
```

## Local development

```bash
# backend (needs a MySQL; or use SQLite for quick tests)
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
DATABASE_URL=sqlite:///./dev.db MODEL_DIR=./artifacts uvicorn app.main:app --reload

# frontend (proxies /api to localhost:8000)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Data format

One row per day. Headers are matched case-insensitively (units in brackets are fine), for example:

| 日期项目 / Date | 入水浑浊度NTU / Influent Turbidity | Influent pH | NaOCl Dosage | Outlet Turbidity | Outlet pH | Outlet Free Chlorine |
|---|---|---|---|---|---|---|

Aliases (e.g. `Sodium Hypochlorite Dosage`, `Residual Chlorine`, `进水浊度`) live in `backend/app/services/variables.py`.
Cleaning: invalid dates dropped, duplicate dates removed (first kept), non-numeric values → missing. Missing values stay NULL in MySQL;
they are time-interpolated only for modelling and Isolation Forest. IQR uses raw values.

## Tests

```bash
cd backend && pip install -r requirements-dev.txt && pytest -q
```

See `docs/TEST_CASES.md` (automated + functional UI test cases) and `docs/RESULTS.md` (results, discussion, limitations).

## Method summary

- **Prediction**: features = six measurements on day *t*, target = outlet turbidity / pH / free chlorine on day *t+1* (only true consecutive days).
  Chronological 80/20 split plus 5-fold expanding-window time-series CV. Metrics: MAE, RMSE, R².
  Naive references (persistence, historical mean) are reported alongside LR and RF.
- **Anomaly detection**: IQR per variable (k = 1.5 default) and Isolation Forest on standardized variables (contamination = 0.05 default),
  both adjustable on the Anomaly page. A flag means "differs from historical pattern", not unsafe water.

## Project layout

```
backend/app/
  main.py            app + startup (create tables, seed demo)
  models.py          datasets, water_records, model_runs, predictions, anomaly_results
  routers/           datasets, analysis (overview/records/EDA), predictions, anomalies
  services/          preprocess, eda, ml, anomaly, demo, variables
frontend/src/
  pages/             Overview, Trends, Prediction, Anomalies, Evaluation, DataManagement
  components/        Layout (sidebar/header), ui (cards, badges, tables), Chart (ECharts wrapper)
```
