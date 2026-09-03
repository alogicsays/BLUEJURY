from fastapi.testclient import TestClient

from bluejury.main import app

client = TestClient(app)


def test_health_endpoints() -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_required_case_routes_are_registered() -> None:
    paths = app.openapi()["paths"]
    assert "post" in paths["/api/v1/cases"]
    assert "get" in paths["/api/v1/cases/{case_id}"]
    assert "get" in paths["/api/v1/cases/{case_id}/decision"]
