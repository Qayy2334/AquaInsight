import os
import tempfile
from pathlib import Path

# Configure an isolated SQLite DB and artifact dir before the app is imported.
_tmp = tempfile.mkdtemp(prefix="wq-test-")
SEED = Path(__file__).resolve().parents[1] / "seed_data" / "tumen_groundwater_2026-08_09.docx"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["MODEL_DIR"] = f"{_tmp}/artifacts"
os.environ["SEED_FILE"] = str(SEED)
os.environ["SEED_DEMO_DATA"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def seed_bytes() -> bytes:
    return SEED.read_bytes()


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c
