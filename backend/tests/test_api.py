"""End-to-end checks through the HTTP API with the real seed dataset (proposal objective 5)."""

import io

import pandas as pd


def test_seeded_with_real_dataset(client):
    ds = client.get("/api/datasets").json()
    assert len(ds) >= 1 and ds[-1]["row_count"] == 61 and ds[-1]["source"] == "upload"


def test_records_match_source(client):
    recs = {r["date"]: r for r in client.get("/api/records").json()}
    assert recs["2026-08-01"]["influent_turbidity"] == 0.33
    assert recs["2026-09-30"]["outlet_free_chlorine"] == 0.35


def test_chronological_split_without_overlap(client):
    for run in client.get("/api/models/runs").json():
        assert run["train_size"] == 48 and run["test_size"] == 12
    rows = client.get("/api/models/predictions", params={"target": "outlet_ph"}).json()["rows"]
    assert rows[0]["date"] == "2026-09-19" and rows[-1]["date"] == "2026-09-30"


def test_all_models_and_references_trained(client):
    types = {(r["target"], r["model_type"]) for r in client.get("/api/models/runs").json()}
    for t in ("outlet_turbidity", "outlet_ph", "outlet_free_chlorine"):
        for m in ("linear_regression", "random_forest", "persistence", "historical_mean"):
            assert (t, m) in types


def test_anomaly_rerun_persists_parameters_and_bounds(client):
    res = client.post("/api/anomalies/detect", json={"iqr_k": 2.0, "contamination": 0.05}).json()
    listed = client.get("/api/anomalies").json()
    assert listed["params"] == {"iqr_k": 2.0, "contamination": 0.05}
    assert listed["iqr_bounds"]["naocl_dosage"] == list(res["iqr_bounds"]["naocl_dosage"])
    client.post("/api/anomalies/detect", json={"iqr_k": 1.5, "contamination": 0.05})


def test_known_low_dosage_days_flagged_by_both_methods(client):
    items = {i["date"]: i for i in client.get("/api/anomalies").json()["items"]}
    assert set(items["2026-09-16"]["methods"]) == {"iqr", "iforest"}


def test_eda_endpoints(client):
    corr = client.get("/api/eda/correlation").json()
    i, j = corr["variables"].index("naocl_dosage"), corr["variables"].index("outlet_free_chlorine")
    assert corr["matrix"][i][j] > 0.95
    assert client.get("/api/eda/histogram", params={"variable": "outlet_ph"}).status_code == 200
    assert client.get("/api/eda/histogram", params={"variable": "nope"}).status_code == 400


def test_exports(client):
    for name, rows in [("records", 62), ("anomalies", None), ("evaluation", 13), ("predictions", None)]:
        r = client.get(f"/api/export/{name}.csv")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        if rows:
            assert len(r.text.strip().splitlines()) == rows


def test_upload_rejects_bad_files(client):
    assert client.post("/api/datasets/upload", files={"file": ("x.txt", b"hi")}).status_code == 400
    assert client.post("/api/datasets/upload", files={"file": ("x.csv", b"a,b\n1,2")}).status_code == 422


def test_upload_new_dataset_becomes_active_and_delete(client, seed_bytes):
    df = pd.DataFrame({"Date": pd.date_range("2026-10-01", periods=40).strftime("%Y-%m-%d"),
                       "Influent Turbidity": 0.2, "Influent pH": 7.5, "NaOCl Dosage": 3.5,
                       "Outlet Turbidity": [0.1 + (i % 5) / 100 for i in range(40)], "Outlet pH": 7.55,
                       "Outlet Free Chlorine": [0.3 + (i % 3) / 100 for i in range(40)]})
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    up = client.post("/api/datasets/upload", files={"file": ("oct.xlsx", buf.getvalue())}).json()
    assert client.get("/api/overview").json()["dataset"]["id"] == up["id"]
    assert client.delete(f"/api/datasets/{up['id']}").status_code == 200
    assert client.get("/api/overview").json()["dataset"]["row_count"] == 61


def test_value_on_iqr_bound_not_flagged_for_that_variable(client):
    # 2026-09-07 dosage 5.0 equals the upper bound (Q3 4.1 + 1.5 * IQR 0.6); only free chlorine 0.45 exceeds its bound.
    item = {i["date"]: i for i in client.get("/api/anomalies").json()["items"]}["2026-09-07"]
    assert [c["variable"] for c in item["details"]["iqr"]["contributors"]] == ["outlet_free_chlorine"]


def test_dashboard_summary(client):
    s = client.get("/api/dashboard/summary").json()
    assert s["dataset"]["rows"] == 61
    assert s["top_correlations"][0]["r"] > 0.95
    assert {c["variable"]: c["within"] for c in s["compliance"]}["outlet_free_chlorine"] == 56
    assert round(s["treatment"]["turbidity"]["change_pct"]) == -31
    assert len(s["predictability"]) == 3
    assert s["anomalies"]["both"] == 3 and s["anomalies"]["iqr"] == 13


def test_dashboard_day_view(client):
    d = client.get("/api/dashboard/day", params={"date": "2026-09-16"}).json()
    assert d["variables"]["naocl_dosage"]["value"] == 1.0 and d["variables"]["naocl_dosage"]["status"] == "low"
    assert set(d["anomaly"]) == {"iqr", "iforest"}
    assert d["prev_date"] == "2026-09-15" and d["next_date"] == "2026-09-17"
    assert len(d["neighbours"]) == 7 and d["predictions"] == {}
    test_day = client.get("/api/dashboard/day", params={"date": "2026-09-27"}).json()
    assert set(test_day["predictions"]) == {"outlet_turbidity", "outlet_ph", "outlet_free_chlorine"}
    assert client.get("/api/dashboard/day", params={"date": "2026-10-05"}).status_code == 404
    edge = client.get("/api/dashboard/day", params={"date": "2026-08-01"}).json()
    assert edge["prev_date"] is None and len(edge["neighbours"]) == 4


def test_duplicate_dates_warned_on_upload(client):
    csv = ("Date,Influent Turbidity,Influent pH,NaOCl Dosage,Outlet Turbidity,Outlet pH,Outlet Free Chlorine\n"
           + "".join(f"2026-11-{d:02d},0.2,7.5,3.5,0.1{d % 5},7.55,0.3{d % 3}\n" for d in range(1, 31))
           + "2026-11-05,9,9,9,9,9,9\n")
    up = client.post("/api/datasets/upload", files={"file": ("dup.csv", csv.encode())}).json()
    assert up["quality_report"]["duplicate_dates"] == ["2026-11-05"]
    assert any("2026-11-05" in w for w in up["warnings"])
    client.delete(f"/api/datasets/{up['id']}")
