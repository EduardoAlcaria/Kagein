from unittest.mock import patch

from fastapi.testclient import TestClient

from app.errors import InvalidCredentialsError, TwoFactorRequiredError
from app.main import app
from app.models import Person

client = TestClient(app)


@patch("app.routes.people.icloud_client.get_people")
def test_list_people_returns_people(mock_get_people):
    mock_get_people.return_value = [
        Person(id="friend-1", name="Jane Doe", latitude=37.33, longitude=-122.0, timestamp_ms=1586034872142)
    ]

    response = client.post("/accounts/user@example.com/people", json={})

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Jane Doe"


@patch("app.routes.people.icloud_client.get_people")
def test_list_people_2fa_required(mock_get_people):
    mock_get_people.side_effect = TwoFactorRequiredError("user@example.com")

    response = client.post("/accounts/user@example.com/people", json={})

    assert response.status_code == 409


@patch("app.routes.people.icloud_client.get_people")
def test_list_people_expired_session(mock_get_people):
    mock_get_people.side_effect = InvalidCredentialsError("session expired")

    response = client.post("/accounts/user@example.com/people", json={})

    assert response.status_code == 401
