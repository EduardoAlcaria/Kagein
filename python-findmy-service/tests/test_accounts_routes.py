from unittest.mock import patch

from fastapi.testclient import TestClient

from app.errors import InvalidCredentialsError
from app.main import app

client = TestClient(app)


@patch("app.routes.accounts.icloud_client.login")
def test_login_success(mock_login):
    mock_login.return_value = "active"

    response = client.post("/accounts/login", json={"apple_id": "user@example.com", "password": "hunter2"})

    assert response.status_code == 200
    assert response.json() == {"status": "active"}


@patch("app.routes.accounts.icloud_client.login")
def test_login_invalid_credentials(mock_login):
    mock_login.side_effect = InvalidCredentialsError("bad creds")

    response = client.post("/accounts/login", json={"apple_id": "user@example.com", "password": "wrong"})

    assert response.status_code == 401


@patch("app.routes.accounts.icloud_client.submit_2fa")
def test_submit_2fa_success(mock_submit):
    mock_submit.return_value = True

    response = client.post("/accounts/user@example.com/2fa", json={"code": "123456"})

    assert response.status_code == 200
    assert response.json() == {"status": "active"}


@patch("app.routes.accounts.icloud_client.submit_2fa")
def test_submit_2fa_invalid_code(mock_submit):
    mock_submit.return_value = False

    response = client.post("/accounts/user@example.com/2fa", json={"code": "000000"})

    assert response.status_code == 400
