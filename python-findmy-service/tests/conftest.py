import pytest


@pytest.fixture(autouse=True)
def internal_service_token(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-token")
