"""Registration, sign-in and API protection."""


def test_protected_endpoints_require_sign_in(anon):
    for url in ("/api/records", "/api/overview", "/api/models/next-day", "/api/anomalies", "/api/export/records.csv"):
        assert anon.get(url).status_code == 401
    assert anon.get("/api/health").status_code == 200
    assert anon.get("/api/records", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_register_login_and_me(anon):
    r = anon.post("/api/auth/register", json={"username": "alice", "password": "pass1234", "display_name": "Alice W"})
    assert r.status_code == 200 and r.json()["user"]["display_name"] == "Alice W"
    token = anon.post("/api/auth/login", json={"username": "alice", "password": "pass1234"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert anon.get("/api/auth/me", headers=h).json()["username"] == "alice"
    assert anon.get("/api/records", headers=h).status_code == 200


def test_register_validation(anon):
    assert anon.post("/api/auth/register", json={"username": "alice", "password": "another1"}).status_code == 409
    assert anon.post("/api/auth/register", json={"username": "ab", "password": "secret123"}).status_code == 422
    assert anon.post("/api/auth/register", json={"username": "bob", "password": "123"}).status_code == 422
    assert anon.post("/api/auth/register", json={"username": "bad name", "password": "secret123"}).status_code == 422


def test_wrong_credentials_rejected(anon):
    assert anon.post("/api/auth/login", json={"username": "alice", "password": "wrong-pass"}).status_code == 401
    assert anon.post("/api/auth/login", json={"username": "nobody", "password": "pass1234"}).status_code == 401


def test_password_not_stored_in_plain_text(client):
    from app.db import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        u = db.query(User).filter_by(username="tester").one()
        assert u.password_hash != "secret123" and u.password_hash.startswith("$2")
