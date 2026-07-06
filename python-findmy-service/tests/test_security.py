from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_does_not_require_token():
    response = client.get("/health")
    assert response.status_code == 200


def test_people_endpoint_rejects_missing_token():
    response = client.post("/accounts/user@example.com/people", json={})
    assert response.status_code == 401


def test_login_endpoint_rejects_wrong_token():
    response = client.post(
        "/accounts/login",
        json={"apple_id": "user@example.com", "password": "hunter2"},
        headers={"X-Internal-Token": "wrong"},
    )
    assert response.status_code == 401


def test_login_endpoint_rejects_when_token_unset(monkeypatch):
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)

    response = client.post(
        "/accounts/login",
        json={"apple_id": "user@example.com", "password": "hunter2"},
        headers={"X-Internal-Token": "test-token"},
    )

    assert response.status_code == 401


@patch("app.routes.accounts.icloud_client.login")
def test_login_endpoint_accepts_correct_token(mock_login):
    mock_login.return_value = "active"

    response = client.post(
        "/accounts/login",
        json={"apple_id": "user@example.com", "password": "hunter2"},
        headers={"X-Internal-Token": "test-token"},
    )

    assert response.status_code == 200
    mock_login.assert_called_once()
