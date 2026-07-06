from unittest.mock import MagicMock, patch

import pytest
from pyicloud.exceptions import PyiCloudFailedLoginException

from app import icloud_client
from app.errors import InvalidCredentialsError, TooManyAttemptsError, TwoFactorRequiredError
from app.models import Person


@pytest.fixture(autouse=True)
def _reset_2fa_attempts():
    icloud_client._failed_2fa_attempts.clear()
    yield
    icloud_client._failed_2fa_attempts.clear()


@patch("app.icloud_client.PyiCloudService")
def test_login_returns_active_when_no_2fa_needed(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.requires_2fa = False
    mock_service_cls.return_value = mock_api

    assert icloud_client.login("user@example.com", "hunter2") == "active"


@patch("app.icloud_client.PyiCloudService")
def test_login_returns_2fa_required(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.requires_2fa = True
    mock_service_cls.return_value = mock_api

    assert icloud_client.login("user@example.com", "hunter2") == "2fa_required"


@patch("app.icloud_client.PyiCloudService")
def test_login_raises_invalid_credentials(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_service_cls.side_effect = PyiCloudFailedLoginException("bad creds")

    with pytest.raises(InvalidCredentialsError):
        icloud_client.login("user@example.com", "wrong")


@patch("app.icloud_client.PyiCloudService")
def test_submit_2fa_success_trusts_session(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.validate_2fa_code.return_value = True
    mock_service_cls.return_value = mock_api

    assert icloud_client.submit_2fa("user@example.com", "123456") is True
    mock_api.trust_session.assert_called_once()


@patch("app.icloud_client.PyiCloudService")
def test_submit_2fa_invalid_code_does_not_trust(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.validate_2fa_code.return_value = False
    mock_service_cls.return_value = mock_api

    assert icloud_client.submit_2fa("user@example.com", "000000") is False
    mock_api.trust_session.assert_not_called()


@patch("app.icloud_client.PyiCloudService")
def test_submit_2fa_raises_invalid_credentials(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_service_cls.side_effect = PyiCloudFailedLoginException("session expired")

    with pytest.raises(InvalidCredentialsError):
        icloud_client.submit_2fa("user@example.com", "123456")


@patch("app.icloud_client.fetch_people")
@patch("app.icloud_client.PyiCloudService")
def test_get_people_raises_when_2fa_pending(mock_service_cls, mock_fetch, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.requires_2fa = True
    mock_service_cls.return_value = mock_api

    with pytest.raises(TwoFactorRequiredError):
        icloud_client.get_people("user@example.com")
    mock_fetch.assert_not_called()


@patch("app.icloud_client.fetch_people")
@patch("app.icloud_client.PyiCloudService")
def test_get_people_returns_parsed_people(mock_service_cls, mock_fetch, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.requires_2fa = False
    mock_service_cls.return_value = mock_api
    mock_fetch.return_value = [Person(id="friend-1", name="Jane Doe")]

    people = icloud_client.get_people("user@example.com")

    assert people[0].name == "Jane Doe"
    mock_fetch.assert_called_once_with(mock_api)


@patch("app.icloud_client.PyiCloudService")
def test_get_people_raises_invalid_credentials_on_expired_session(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_service_cls.side_effect = PyiCloudFailedLoginException("session expired")

    with pytest.raises(InvalidCredentialsError):
        icloud_client.get_people("user@example.com")


@patch("app.icloud_client.PyiCloudService")
def test_submit_2fa_locks_out_after_max_failures(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_api.validate_2fa_code.return_value = False
    mock_service_cls.return_value = mock_api

    for _ in range(5):
        assert icloud_client.submit_2fa("user@example.com", "000000") is False

    with pytest.raises(TooManyAttemptsError):
        icloud_client.submit_2fa("user@example.com", "000000")


@patch("app.icloud_client.PyiCloudService")
def test_submit_2fa_success_clears_failure_count(mock_service_cls, monkeypatch, tmp_path):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))
    mock_api = MagicMock()
    mock_service_cls.return_value = mock_api

    mock_api.validate_2fa_code.return_value = False
    for _ in range(4):
        icloud_client.submit_2fa("user@example.com", "000000")

    mock_api.validate_2fa_code.return_value = True
    assert icloud_client.submit_2fa("user@example.com", "123456") is True

    mock_api.validate_2fa_code.return_value = False
    for _ in range(4):
        assert icloud_client.submit_2fa("user@example.com", "000000") is False
