"""End-to-end checks through the HTTP API with the real seed data (proposal objective 5).

Read-only checks come first; tests that change records come last and restore the original 61 days.
"""

SEED_NAME = "tumen_groundwater_2026-08_09.docx"
HEADER = "Date,Influent Turbidity,Influent pH,NaOCl Dosage,Outlet Turbidity,Outlet pH,Outlet Free Chlorine\n"
DAY_0930 = {"influent_turbidity": 0.15, "influent_ph": 7.47, "naocl_dosage": 4.0,
            "outlet_turbidity": 0.14, "outlet_ph": 7.59, "outlet_free_chlorine": 0.35}


def _csv(*rows: str) -> bytes:
    return (HEADER + "".join(r + "\n" for r in rows)).encode()


# ---------------------------------------------------------------- read-only


def test_seeded_from_plant_log(client):
    assert client.get("/api/records/summary").json()["rows"] == 61
    uploads = client.get("/api/uploads").json()
    assert uploads[-1]["filename"] == SEED_NAME and uploads[-1]["added"] == 61


def test_records_match_source_and_carry_origin(client):
    recs = {r["date"]: r for r in client.get("/api/records").json()}
    assert recs["2026-08-01"]["influent_turbidity"] == 0.33
    assert recs["2026-09-30"]["outlet_free_chlorine"] == 0.35
    assert recs["2026-09-30"]["source"] == f"upload: {SEED_NAME}"


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


def test_value_on_iqr_bound_not_flagged_for_that_variable(client):
    # 2026-09-07 dosage 5.0 equals the upper bound (Q3 4.1 + 1.5 * IQR 0.6); only free chlorine 0.45 exceeds its bound.
    item = {i["date"]: i for i in client.get("/api/anomalies").json()["items"]}["2026-09-07"]
    assert [c["variable"] for c in item["details"]["iqr"]["contributors"]] == ["outlet_free_chlorine"]


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


def test_next_day_forecast(client):
    f = client.get("/api/models/next-day").json()
    assert f["based_on"] == "2026-09-30" and f["for_date"] == "2026-10-01"
    assert set(f["forecasts"]) == {"outlet_turbidity", "outlet_ph", "outlet_free_chlorine"}
    for fc in f["forecasts"].values():
        assert fc["recommended_model"] in ("linear_regression", "random_forest")
        rec = fc["models"][fc["recommended_model"]]
        assert fc["value"] == rec["value"] and fc["error"] == rec["cv_mae"]
        assert all(rec["cv_mae"] <= m["cv_mae"] for m in fc["models"].values())
        # On this dataset no model beats the historical mean, so every forecast is marked limited.
        assert fc["reliability"] == "limited"
    assert f["forecasts"]["outlet_free_chlorine"]["current"] == 0.35


def test_upload_rejects_bad_files(client):
    assert client.post("/api/records/upload/preview", files={"file": ("x.txt", b"hi")}).status_code == 400
    assert client.post("/api/records/upload/preview", files={"file": ("x.csv", b"a,b\n1,2")}).status_code == 422


def test_preview_of_same_file_changes_nothing(client, seed_bytes):
    p = client.post("/api/records/upload/preview", files={"file": (SEED_NAME, seed_bytes)}).json()
    assert p["new"] == [] and p["conflicts"] == [] and len(p["identical"]) == 61
    assert client.get("/api/records/summary").json()["rows"] == 61


def test_preview_reports_duplicate_dates_in_file(client):
    p = client.post("/api/records/upload/preview",
                    files={"file": ("dup.csv", _csv("2027-01-01,0.2,7.5,3.5,0.1,7.55,0.3",
                                                    "2027-01-01,9,9,9,9,9,9"))}).json()
    assert p["file_report"]["duplicate_dates"] == ["2027-01-01"]
    assert [n["date"] for n in p["new"]] == ["2027-01-01"]


# ---------------------------------------------------------------- changes (restore afterwards)


def test_merge_upload_new_day_and_conflict(client):
    file = _csv("2026-09-30,0.15,7.47,4.0,0.14,7.59,0.40",  # differs from stored 0.35
                "2026-10-01,0.20,7.50,3.5,0.12,7.55,0.30")  # new day
    p = client.post("/api/records/upload/preview", files={"file": ("oct.csv", file)}).json()
    assert [n["date"] for n in p["new"]] == ["2026-10-01"]
    assert p["conflicts"][0]["date"] == "2026-09-30" and p["conflicts"][0]["changed"] == ["outlet_free_chlorine"]

    # Without overwrite: new day added, conflicting day kept.
    up = client.post("/api/records/upload", files={"file": ("oct.csv", file)}).json()
    assert (up["added"], up["updated"], up["skipped"]) == (1, 0, 1)
    recs = {r["date"]: r for r in client.get("/api/records").json()}
    assert recs["2026-09-30"]["outlet_free_chlorine"] == 0.35 and recs["2026-10-01"]["source"] == "upload: oct.csv"

    # With overwrite: conflicting day replaced and logged.
    up = client.post("/api/records/upload", files={"file": ("oct.csv", file)},
                     data={"overwrite": '["2026-09-30"]'}).json()
    assert (up["added"], up["updated"]) == (0, 1)
    assert {r["date"]: r for r in client.get("/api/records").json()}["2026-09-30"]["outlet_free_chlorine"] == 0.40
    hist = client.get("/api/records/2026-09-30/history").json()
    assert hist[0]["action"] == "update" and hist[0]["old"]["outlet_free_chlorine"] == 0.35

    # Analysis was re-run on 62 days.
    assert client.get("/api/models/next-day").json()["based_on"] == "2026-10-01"

    # Restore.
    assert client.put("/api/records/2026-09-30", json=DAY_0930).status_code == 200
    assert client.delete("/api/records/2026-10-01").status_code == 200
    assert client.get("/api/records/summary").json()["rows"] == 61
    assert client.get("/api/models/next-day").json()["based_on"] == "2026-09-30"


def test_manual_add_edit_delete_with_history(client):
    day = {"date": "2026-10-01", **DAY_0930}
    assert client.post("/api/records", json=day).status_code == 200
    assert client.post("/api/records", json=day).status_code == 409
    assert client.put("/api/records/2026-10-01", json={**DAY_0930, "outlet_ph": 7.7}).status_code == 200
    rec = {r["date"]: r for r in client.get("/api/records").json()}["2026-10-01"]
    assert rec["outlet_ph"] == 7.7 and rec["source"] == "manual"
    # Newest first; earlier tests may have left older entries for this date.
    assert [h["action"] for h in client.get("/api/records/2026-10-01/history").json()][:2] == ["update", "create"]
    assert client.delete("/api/records/2026-10-01").status_code == 200
    assert client.delete("/api/records/2026-10-01").status_code == 404
    assert client.put("/api/records/2026-10-09", json=DAY_0930).status_code == 404
    assert [h["action"] for h in client.get("/api/records/2026-10-01/history").json()][0] == "delete"
    assert client.get("/api/records/summary").json()["rows"] == 61


def test_commit_warns_about_duplicate_dates(client):
    up = client.post("/api/records/upload",
                     files={"file": ("dup.csv", _csv("2027-01-01,0.2,7.5,3.5,0.1,7.55,0.3",
                                                     "2027-01-01,9,9,9,9,9,9"))}).json()
    assert up["added"] == 1 and any("2027-01-01" in w for w in up["warnings"])
    client.delete("/api/records/2027-01-01")
    assert client.get("/api/records/summary").json()["rows"] == 61
