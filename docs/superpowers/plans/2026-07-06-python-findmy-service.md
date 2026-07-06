# python-findmy-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stateless FastAPI microservice that logs into a real Apple ID (via `pyicloud`), handles its 2FA challenge, and returns the list of people currently sharing their location with that account (the Find My "People" tab / `fmf` webservice) — no device tracking, no anisette, no custom crypto.

**Architecture:** One FastAPI app with three internal modules — `cookies` (per-account session directory), `friends` (parses the `fmf` JSON response into `Person` objects, pure function, no network), and `icloud_client` (wraps `pyicloud.PyiCloudService` for login/2FA/fetch). Routes are a thin HTTP layer over `icloud_client`. No database — session state lives entirely in `pyicloud`'s own cookie-jar files on a Docker volume, keyed by `sha256(apple_id)`.

**Tech Stack:** Python 3.12, FastAPI 0.139.0, uvicorn 0.50.0, pyicloud 2.6.5 (the `timlaing/pyicloud` fork — this is what PyPI's `pyicloud` package now resolves to), pytest 9.1.1, httpx 0.28.1 (required by FastAPI's `TestClient`).

## Global Constraints

- No database in this service — see spec's "Protocol notes" and "Architecture" sections (`docs/superpowers/specs/2026-07-06-findmy-dashboard-design.md`). Account credentials are never persisted here beyond `pyicloud`'s own cookie files.
- Every call takes `apple_id` explicitly; this service holds no account registry.
- `POST /accounts/{apple_id}/people` (not GET) — a password may need to travel with the request when a fresh login is required, and it must never appear in a URL or query string.
- One commit per completed task, pushed immediately (repo: `https://github.com/EduardoAlcaria/Kagein`).

---

## Task 1: Manual protocol spike against a real Apple ID

This has to come first: the `fmf` endpoint is undocumented and reverse-engineered from an unmerged pyicloud PR. Everything downstream (the `friends.py` parser, its test fixture) assumes a response shape that has not yet been confirmed against a live account. Confirm it before writing production code around it.

**Files:**
- Create: `python-findmy-service/scripts/spike_login.py`

**Interfaces:**
- Produces: a confirmed real JSON shape for the `fmf` response, used to write (or correct) the fixture in Task 4.

- [ ] **Step 1: Write the spike script**

```python
"""Manual spike: run once against a real Apple ID to confirm the fmf flow.

Usage: python scripts/spike_login.py
Not part of the test suite - requires interactive input and a live Apple ID.
"""
import getpass
import json

from pyicloud import PyiCloudService

apple_id = input("Apple ID: ")
password = getpass.getpass("Password: ")

api = PyiCloudService(apple_id, password, cookie_directory=".spike-session")

if api.requires_2fa:
    code = input("2FA code: ")
    if not api.validate_2fa_code(code):
        raise SystemExit("2FA code rejected")
    api.trust_session()
    print("2FA validated and session trusted.")
else:
    print("No 2FA challenge - session already trusted.")

service_root = api.get_webservice_url("fmf")
endpoint = f"{service_root}/fmipservice/client/fmfWeb/initClient"
payload = {
    "clientContext": {
        "appVersion": "1.0",
        "contextApp": "com.icloud.web.fmf",
        "mapkitAvailable": True,
        "productType": "fmfWeb",
        "tileServer": "Apple",
        "userInactivityTimeInMS": 537,
        "windowInFocus": False,
        "windowVisible": True,
    }
}
response = api.session.post(endpoint, params=api.params, data=json.dumps(payload))
response.raise_for_status()
print(json.dumps(response.json(), indent=2))
```

- [ ] **Step 2: Install pyicloud locally and run the spike**

```bash
pip install pyicloud==2.6.5
python python-findmy-service/scripts/spike_login.py
```

Enter your real Apple ID + password (+ 2FA code if prompted). Expected: a
JSON dump with top-level `locations` and `contactDetails` arrays.

- [ ] **Step 3: Compare the real response against the assumed shape**

Assumed shape (from the unmerged pyicloud PR #160):
```json
{
  "locations": [{"id": "...", "location": {"latitude": 0.0, "longitude": 0.0, "timestamp": 0}}],
  "contactDetails": [{"id": "...", "firstName": "...", "lastName": "..."}]
}
```

If the real response matches, proceed to Task 4 using the fixture as
written. If it differs (renamed fields, nesting changes, additional
required request headers), note the actual shape here — it becomes the
fixture in Task 4 and the parsing logic in `friends.py` must match it, not
the assumed shape above.

- [ ] **Step 4: Delete the spike's local session directory**

```bash
rm -rf .spike-session
```

This is a throwaway credential cache from the manual run — don't commit it
(add `.spike-session/` to `.gitignore` in Task 2).

No commit for this task — it produces no shippable code, only the
confirmed protocol shape carried into Task 4.

---

## Task 2: Project scaffold — FastAPI app with a health check

**Files:**
- Create: `python-findmy-service/requirements.txt`
- Create: `python-findmy-service/app/__init__.py`
- Create: `python-findmy-service/app/main.py`
- Create: `python-findmy-service/tests/__init__.py`
- Create: `python-findmy-service/tests/test_health.py`
- Create: `python-findmy-service/.gitignore`

**Interfaces:**
- Produces: `app.main.app` (FastAPI instance) — Task 6 will attach routers to it.

- [ ] **Step 1: Write the failing test**

```python
# python-findmy-service/tests/test_health.py
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Create requirements.txt and install**

```
fastapi==0.139.0
uvicorn==0.50.0
pyicloud==2.6.5
pytest==9.1.1
httpx==0.28.1
```

```bash
cd python-findmy-service
pip install -r requirements.txt
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_health.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.main'` or import error)

- [ ] **Step 4: Write the app**

```python
# python-findmy-service/app/__init__.py
```
(empty file, marks `app` as a package)

```python
# python-findmy-service/app/main.py
from fastapi import FastAPI

app = FastAPI(title="python-findmy-service")


@app.get("/health")
def health():
    return {"status": "ok"}
```

```python
# python-findmy-service/tests/__init__.py
```
(empty file)

```
# python-findmy-service/.gitignore
__pycache__/
*.pyc
.pytest_cache/
.spike-session/
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd python-findmy-service && pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add python-findmy-service/requirements.txt python-findmy-service/app/__init__.py python-findmy-service/app/main.py python-findmy-service/tests/__init__.py python-findmy-service/tests/test_health.py python-findmy-service/.gitignore
git commit -m "Scaffold python-findmy-service with health check"
git push
```

---

## Task 3: Per-account cookie directory

**Files:**
- Create: `python-findmy-service/app/cookies.py`
- Create: `python-findmy-service/tests/test_cookies.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `cookies.cookie_directory_for(apple_id: str) -> str` — used by `icloud_client` (Task 5) as the `cookie_directory` argument to `PyiCloudService`.

- [ ] **Step 1: Write the failing tests**

```python
# python-findmy-service/tests/test_cookies.py
from pathlib import Path

from app import cookies


def test_cookie_directory_for_is_stable(tmp_path, monkeypatch):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))

    first = cookies.cookie_directory_for("user@example.com")
    second = cookies.cookie_directory_for("user@example.com")

    assert first == second
    assert Path(first).is_dir()
    assert Path(first).parent == tmp_path


def test_cookie_directory_for_differs_per_account(tmp_path, monkeypatch):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))

    a = cookies.cookie_directory_for("a@example.com")
    b = cookies.cookie_directory_for("b@example.com")

    assert a != b
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_cookies.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.cookies'`)

- [ ] **Step 3: Implement**

```python
# python-findmy-service/app/cookies.py
import hashlib
import os
from pathlib import Path


def cookie_root() -> Path:
    return Path(os.environ.get("COOKIE_ROOT", "/data/sessions"))


def cookie_directory_for(apple_id: str) -> str:
    digest = hashlib.sha256(apple_id.encode("utf-8")).hexdigest()
    path = cookie_root() / digest
    path.mkdir(parents=True, exist_ok=True)
    return str(path)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd python-findmy-service && pytest tests/test_cookies.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add python-findmy-service/app/cookies.py python-findmy-service/tests/test_cookies.py
git commit -m "Add per-account cookie directory helper"
git push
```

---

## Task 4: Friends response parser

**Files:**
- Create: `python-findmy-service/app/models.py`
- Create: `python-findmy-service/app/friends.py`
- Create: `python-findmy-service/tests/fixtures/fmf_response.json`
- Create: `python-findmy-service/tests/test_friends.py`

**Interfaces:**
- Consumes: nothing new (pure data transform).
- Produces: `models.Person` (fields: `id: str`, `name: str`, `latitude: float | None`, `longitude: float | None`, `timestamp_ms: int | None`), `friends.parse_people(data: dict) -> list[Person]`, `friends.fetch_people(api) -> list[Person]`, `friends.FMF_CLIENT_CONTEXT: dict`. `icloud_client` (Task 5) calls `fetch_people`; routes (Task 6) serialize `Person` via `.model_dump()`.

- [ ] **Step 1: Write the fixture**

If Task 1's spike showed a different real shape, use that shape here
instead of the one below.

```json
{
  "locations": [
    {
      "id": "friend-1",
      "location": {
        "latitude": 37.3329141300381,
        "longitude": -122.00520223179473,
        "timestamp": 1586034872142
      }
    },
    {
      "id": "friend-2",
      "location": null
    }
  ],
  "contactDetails": [
    {"id": "friend-1", "firstName": "Jane", "lastName": "Doe"},
    {"id": "friend-2", "firstName": "John", "lastName": "Smith"}
  ]
}
```
(save as `python-findmy-service/tests/fixtures/fmf_response.json`)

- [ ] **Step 2: Write the failing tests**

```python
# python-findmy-service/tests/test_friends.py
import json
from pathlib import Path

from app.friends import parse_people

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "fmf_response.json"


def _load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text())


def test_parse_people_joins_location_and_contact_name():
    people = parse_people(_load_fixture())

    assert len(people) == 2
    jane = next(p for p in people if p.id == "friend-1")
    assert jane.name == "Jane Doe"
    assert jane.latitude == 37.3329141300381
    assert jane.longitude == -122.00520223179473
    assert jane.timestamp_ms == 1586034872142


def test_parse_people_handles_missing_location():
    people = parse_people(_load_fixture())

    john = next(p for p in people if p.id == "friend-2")
    assert john.latitude is None
    assert john.longitude is None
    assert john.timestamp_ms is None


def test_parse_people_falls_back_to_id_when_name_missing():
    data = {
        "locations": [{"id": "friend-3", "location": {"latitude": 1.0, "longitude": 2.0, "timestamp": 100}}],
        "contactDetails": [],
    }

    people = parse_people(data)

    assert people[0].name == "friend-3"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_friends.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.friends'`)

- [ ] **Step 4: Implement models.py and friends.py**

```python
# python-findmy-service/app/models.py
from typing import Optional

from pydantic import BaseModel


class Person(BaseModel):
    id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp_ms: Optional[int] = None
```

```python
# python-findmy-service/app/friends.py
import json

from app.models import Person

FMF_CLIENT_CONTEXT = {
    "clientContext": {
        "appVersion": "1.0",
        "contextApp": "com.icloud.web.fmf",
        "mapkitAvailable": True,
        "productType": "fmfWeb",
        "tileServer": "Apple",
        "userInactivityTimeInMS": 537,
        "windowInFocus": False,
        "windowVisible": True,
    }
}


def parse_people(data: dict) -> list[Person]:
    contacts_by_id = {c["id"]: c for c in data.get("contactDetails", [])}
    people = []
    for entry in data.get("locations", []):
        person_id = entry["id"]
        location = entry.get("location") or {}
        contact = contacts_by_id.get(person_id, {})
        name = f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip()
        people.append(
            Person(
                id=person_id,
                name=name or person_id,
                latitude=location.get("latitude"),
                longitude=location.get("longitude"),
                timestamp_ms=location.get("timestamp"),
            )
        )
    return people


def fetch_people(api) -> list[Person]:
    service_root = api.get_webservice_url("fmf")
    endpoint = f"{service_root}/fmipservice/client/fmfWeb/initClient"
    response = api.session.post(endpoint, params=api.params, data=json.dumps(FMF_CLIENT_CONTEXT))
    response.raise_for_status()
    return parse_people(response.json())
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd python-findmy-service && pytest tests/test_friends.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add python-findmy-service/app/models.py python-findmy-service/app/friends.py python-findmy-service/tests/fixtures/fmf_response.json python-findmy-service/tests/test_friends.py
git commit -m "Add fmf response parser and Person model"
git push
```

---

## Task 5: Apple ID login / 2FA / people wrapper

**Files:**
- Create: `python-findmy-service/app/errors.py`
- Create: `python-findmy-service/app/icloud_client.py`
- Create: `python-findmy-service/tests/test_icloud_client.py`

**Interfaces:**
- Consumes: `cookies.cookie_directory_for` (Task 3), `friends.fetch_people` (Task 4), `models.Person` (Task 4).
- Produces: `errors.InvalidCredentialsError`, `errors.TwoFactorRequiredError`, `icloud_client.login(apple_id: str, password: str) -> str` (returns `"active"` or `"2fa_required"`), `icloud_client.submit_2fa(apple_id: str, code: str) -> bool`, `icloud_client.get_people(apple_id: str, password: str | None = None) -> list[Person]`. Routes (Task 6) call all three.

- [ ] **Step 1: Write the failing tests**

```python
# python-findmy-service/tests/test_icloud_client.py
from unittest.mock import MagicMock, patch

import pytest
from pyicloud.exceptions import PyiCloudFailedLoginException

from app import icloud_client
from app.errors import InvalidCredentialsError, TwoFactorRequiredError
from app.models import Person


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_icloud_client.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.icloud_client'`)

- [ ] **Step 3: Implement**

```python
# python-findmy-service/app/errors.py
class InvalidCredentialsError(Exception):
    pass


class TwoFactorRequiredError(Exception):
    def __init__(self, apple_id: str):
        self.apple_id = apple_id
        super().__init__(f"2FA required for {apple_id}")
```

```python
# python-findmy-service/app/icloud_client.py
from typing import Optional

from pyicloud import PyiCloudService
from pyicloud.exceptions import PyiCloudFailedLoginException

from app.cookies import cookie_directory_for
from app.errors import InvalidCredentialsError, TwoFactorRequiredError
from app.friends import fetch_people
from app.models import Person


def login(apple_id: str, password: str) -> str:
    try:
        api = PyiCloudService(apple_id, password, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
    return "2fa_required" if api.requires_2fa else "active"


def submit_2fa(apple_id: str, code: str) -> bool:
    api = PyiCloudService(apple_id, cookie_directory=cookie_directory_for(apple_id))
    if not api.validate_2fa_code(code):
        return False
    api.trust_session()
    return True


def get_people(apple_id: str, password: Optional[str] = None) -> list[Person]:
    try:
        api = PyiCloudService(apple_id, password, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
    if api.requires_2fa:
        raise TwoFactorRequiredError(apple_id)
    return fetch_people(api)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd python-findmy-service && pytest tests/test_icloud_client.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add python-findmy-service/app/errors.py python-findmy-service/app/icloud_client.py python-findmy-service/tests/test_icloud_client.py
git commit -m "Add icloud_client wrapping pyicloud login, 2FA, and people fetch"
git push
```

---

## Task 6: HTTP routes

**Files:**
- Create: `python-findmy-service/app/routes/__init__.py`
- Create: `python-findmy-service/app/routes/accounts.py`
- Create: `python-findmy-service/app/routes/people.py`
- Modify: `python-findmy-service/app/main.py`
- Create: `python-findmy-service/tests/test_accounts_routes.py`
- Create: `python-findmy-service/tests/test_people_routes.py`

**Interfaces:**
- Consumes: `icloud_client.login`, `icloud_client.submit_2fa`, `icloud_client.get_people` (Task 5), `errors.InvalidCredentialsError`, `errors.TwoFactorRequiredError` (Task 5).
- Produces: `POST /accounts/login`, `POST /accounts/{apple_id}/2fa`, `POST /accounts/{apple_id}/people` on `app.main.app` — this is the contract spring-bff (next plan) is built against.

- [ ] **Step 1: Write the failing tests**

```python
# python-findmy-service/tests/test_accounts_routes.py
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
```

```python
# python-findmy-service/tests/test_people_routes.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_accounts_routes.py tests/test_people_routes.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.routes'`)

- [ ] **Step 3: Implement routes**

```python
# python-findmy-service/app/routes/__init__.py
```
(empty file)

```python
# python-findmy-service/app/routes/accounts.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import icloud_client
from app.errors import InvalidCredentialsError

router = APIRouter(prefix="/accounts", tags=["accounts"])


class LoginRequest(BaseModel):
    apple_id: str
    password: str


class TwoFARequest(BaseModel):
    code: str


@router.post("/login")
def login(body: LoginRequest):
    try:
        status = icloud_client.login(body.apple_id, body.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="invalid credentials")
    return {"status": status}


@router.post("/{apple_id}/2fa")
def submit_2fa(apple_id: str, body: TwoFARequest):
    if not icloud_client.submit_2fa(apple_id, body.code):
        raise HTTPException(status_code=400, detail="invalid code")
    return {"status": "active"}
```

```python
# python-findmy-service/app/routes/people.py
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import icloud_client
from app.errors import InvalidCredentialsError, TwoFactorRequiredError

router = APIRouter(prefix="/accounts", tags=["people"])


class PeopleRequest(BaseModel):
    password: Optional[str] = None


@router.post("/{apple_id}/people")
def list_people(apple_id: str, body: PeopleRequest = PeopleRequest()):
    try:
        people = icloud_client.get_people(apple_id, body.password)
    except TwoFactorRequiredError:
        raise HTTPException(status_code=409, detail="2fa_required")
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="session expired or invalid credentials")
    return [p.model_dump() for p in people]
```

```python
# python-findmy-service/app/main.py
from fastapi import FastAPI

from app.routes import accounts, people

app = FastAPI(title="python-findmy-service")
app.include_router(accounts.router)
app.include_router(people.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `cd python-findmy-service && pytest -v`
Expected: PASS (all tests across every task so far)

- [ ] **Step 5: Commit**

```bash
git add python-findmy-service/app/routes/ python-findmy-service/app/main.py python-findmy-service/tests/test_accounts_routes.py python-findmy-service/tests/test_people_routes.py
git commit -m "Wire accounts and people HTTP routes"
git push
```

---

## Task 7: Dockerize and smoke-test locally

**Files:**
- Create: `python-findmy-service/Dockerfile`
- Create: `docker-compose.yml` (repo root)

**Interfaces:**
- Consumes: `app.main.app` (Task 6).
- Produces: a running container on port 8000, `COOKIE_ROOT=/data/sessions` volume — this is the container spring-bff (next plan) will call over the docker-compose network by service name `python-findmy-service`.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# python-findmy-service/Dockerfile
FROM python:3.12-slim

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV COOKIE_ROOT=/data/sessions
VOLUME ["/data/sessions"]

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write the root docker-compose.yml**

```yaml
# docker-compose.yml
services:
  python-findmy-service:
    build: ./python-findmy-service
    ports:
      - "8000:8000"
    volumes:
      - findmy_sessions:/data/sessions
    environment:
      - COOKIE_ROOT=/data/sessions

volumes:
  findmy_sessions:
```

- [ ] **Step 3: Build and run**

```bash
docker compose build python-findmy-service
docker compose up -d python-findmy-service
```

- [ ] **Step 4: Smoke-test the health endpoint**

```bash
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 5: Tear down**

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add python-findmy-service/Dockerfile docker-compose.yml
git commit -m "Dockerize python-findmy-service"
git push
```

---

## Task 8: Internal auth token, 2FA rate limiting, host port lockdown

Added after an automated security review of Tasks 2-7 flagged two Broken
Access Control findings: `POST /accounts/{apple_id}/people` had no way to
verify the caller is entitled to that `apple_id` (IDOR-shaped), and
`POST /accounts/{apple_id}/2fa` had no rate limiting on a 6-digit code
(10^6 space, brute-forceable). Full per-caller/per-account auth (as a
generic reviewer would suggest) doesn't fit this service's actual threat
model — spring-bff is the only caller this service will ever have, for a
single user's own account(s), not a multi-tenant system. The proportionate
fix is: (1) a shared secret only spring-bff knows, so nothing else on the
Docker network (or, if the port is ever misconfigured, the LAN) can call
this service at all, and (2) a rate limit on 2FA attempts regardless of
who's calling. Also: the docker-compose.yml written in Task 7 published
port 8000 to all host interfaces (`"8000:8000"`) rather than binding it to
localhost only — fixing that here too, since it's the same class of
exposure.

**Files:**
- Create: `python-findmy-service/app/security.py`
- Create: `python-findmy-service/tests/conftest.py`
- Create: `python-findmy-service/tests/test_security.py`
- Modify: `python-findmy-service/app/errors.py`
- Modify: `python-findmy-service/app/icloud_client.py`
- Modify: `python-findmy-service/app/routes/accounts.py`
- Modify: `python-findmy-service/app/routes/people.py`
- Modify: `python-findmy-service/tests/test_accounts_routes.py`
- Modify: `python-findmy-service/tests/test_icloud_client.py`
- Modify: `docker-compose.yml` (repo root)
- Create: `.gitignore` (repo root)

**Interfaces:**
- Consumes: existing `app.routes.accounts.router`, `app.routes.people.router` (Task 6), `app.icloud_client.submit_2fa` (Task 5), `app.errors` (Task 5).
- Produces: `security.require_internal_token` (FastAPI dependency, applied at router level to both routers), `errors.TooManyAttemptsError`.

- [ ] **Step 1: Write the failing tests for the internal-token dependency**

```python
# python-findmy-service/tests/conftest.py
import pytest


@pytest.fixture(autouse=True)
def internal_service_token(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-token")
```

```python
# python-findmy-service/tests/test_security.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_security.py -v`
Expected: FAIL — `test_people_endpoint_rejects_missing_token` and
`test_login_endpoint_rejects_wrong_token` currently return 200/other (no
auth gate exists yet), not 401.

- [ ] **Step 3: Implement the dependency and wire it into both routers**

```python
# python-findmy-service/app/security.py
import os

from fastapi import Header, HTTPException


def require_internal_token(x_internal_token: str = Header(default="")) -> None:
    expected = os.environ.get("INTERNAL_SERVICE_TOKEN")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="invalid or missing internal token")
```

In `python-findmy-service/app/routes/accounts.py`, change the imports and
router declaration (keep everything else in the file unchanged):

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import icloud_client
from app.errors import InvalidCredentialsError, TooManyAttemptsError
from app.security import require_internal_token

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_internal_token)])
```

In `python-findmy-service/app/routes/people.py`, change the imports and
router declaration (keep everything else in the file unchanged):

```python
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import icloud_client
from app.errors import InvalidCredentialsError, TwoFactorRequiredError
from app.security import require_internal_token

router = APIRouter(prefix="/accounts", tags=["people"], dependencies=[Depends(require_internal_token)])
```

- [ ] **Step 4: Add the required header to every existing route test**

In both `python-findmy-service/tests/test_accounts_routes.py` and
`python-findmy-service/tests/test_people_routes.py`, add
`headers={"X-Internal-Token": "test-token"}` as a kwarg to every existing
`client.post(...)` call (5 calls in the accounts file, 3 in the people
file). Nothing else in either file changes — the `conftest.py` autouse
fixture from Step 1 makes `"test-token"` the valid value for the whole
test session.

Example (one of five in test_accounts_routes.py — apply the same kwarg
to the other four `client.post` calls in that file, and all three in
test_people_routes.py):

```python
    response = client.post(
        "/accounts/login",
        json={"apple_id": "user@example.com", "password": "hunter2"},
        headers={"X-Internal-Token": "test-token"},
    )
```

- [ ] **Step 5: Run the full suite to verify everything passes**

Run: `cd python-findmy-service && pytest -v`
Expected: PASS — all prior tasks' tests still pass (now sending the
header), plus the 5 new `test_security.py` tests.

- [ ] **Step 6: Commit**

```bash
git add python-findmy-service/app/security.py python-findmy-service/tests/conftest.py python-findmy-service/tests/test_security.py python-findmy-service/app/routes/accounts.py python-findmy-service/app/routes/people.py python-findmy-service/tests/test_accounts_routes.py python-findmy-service/tests/test_people_routes.py
git commit -m "Require internal shared-secret token on accounts/people routes"
git push
```

- [ ] **Step 7: Write the failing tests for 2FA attempt rate limiting**

Add to `python-findmy-service/tests/test_icloud_client.py` (needs a new
import: `from app.errors import TooManyAttemptsError` alongside the
existing `InvalidCredentialsError, TwoFactorRequiredError` import, and a
fixture to reset the module-level attempt counter between tests since
it's a plain module dict, not per-test state):

```python
@pytest.fixture(autouse=True)
def _reset_2fa_attempts():
    icloud_client._failed_2fa_attempts.clear()
    yield
    icloud_client._failed_2fa_attempts.clear()
```

(add `from app import icloud_client` if the test file doesn't already
import the module itself — check the existing `from app import
icloud_client` / `from app.icloud_client import ...` style already used
in this file and match it)

```python
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
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `cd python-findmy-service && pytest tests/test_icloud_client.py -v`
Expected: FAIL — `TooManyAttemptsError` doesn't exist yet, `AttributeError`.

- [ ] **Step 9: Implement rate limiting**

```python
# python-findmy-service/app/errors.py
class InvalidCredentialsError(Exception):
    pass


class TwoFactorRequiredError(Exception):
    def __init__(self, apple_id: str):
        self.apple_id = apple_id
        super().__init__(f"2FA required for {apple_id}")


class TooManyAttemptsError(Exception):
    def __init__(self, apple_id: str):
        self.apple_id = apple_id
        super().__init__(f"too many 2FA attempts for {apple_id}")
```

In `python-findmy-service/app/icloud_client.py`, add near the top (after
the existing imports) and change `submit_2fa`:

```python
import time

MAX_2FA_ATTEMPTS = 5
TWO_FA_LOCKOUT_WINDOW_SECONDS = 15 * 60
_failed_2fa_attempts: dict[str, list[float]] = {}


def _recent_2fa_failures(apple_id: str) -> list[float]:
    now = time.time()
    recent = [t for t in _failed_2fa_attempts.get(apple_id, []) if now - t < TWO_FA_LOCKOUT_WINDOW_SECONDS]
    _failed_2fa_attempts[apple_id] = recent
    return recent


def submit_2fa(apple_id: str, code: str) -> bool:
    if len(_recent_2fa_failures(apple_id)) >= MAX_2FA_ATTEMPTS:
        raise TooManyAttemptsError(apple_id)
    try:
        api = PyiCloudService(apple_id, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
    if not api.validate_2fa_code(code):
        _failed_2fa_attempts.setdefault(apple_id, []).append(time.time())
        return False
    _failed_2fa_attempts.pop(apple_id, None)
    api.trust_session()
    return True
```

Update the import line at the top of `icloud_client.py` to also import
`TooManyAttemptsError`:

```python
from app.errors import InvalidCredentialsError, TooManyAttemptsError, TwoFactorRequiredError
```

In `python-findmy-service/app/routes/accounts.py`, catch the new
exception in the 2fa route (the `TooManyAttemptsError` import was already
added to this file's import line in Step 3):

```python
@router.post("/{apple_id}/2fa")
def submit_2fa(apple_id: str, body: TwoFARequest):
    try:
        if not icloud_client.submit_2fa(apple_id, body.code):
            raise HTTPException(status_code=400, detail="invalid code")
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="session expired or invalid credentials")
    except TooManyAttemptsError:
        raise HTTPException(status_code=429, detail="too many attempts, try again later")
    return {"status": "active"}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd python-findmy-service && pytest -v`
Expected: PASS — full suite, including the 2 new rate-limit tests.

- [ ] **Step 11: Commit**

```bash
git add python-findmy-service/app/errors.py python-findmy-service/app/icloud_client.py python-findmy-service/app/routes/accounts.py python-findmy-service/tests/test_icloud_client.py
git commit -m "Rate-limit 2FA submission attempts per account"
git push
```

- [ ] **Step 12: Lock down the docker-compose port binding**

```yaml
# docker-compose.yml (repo root)
services:
  python-findmy-service:
    build: ./python-findmy-service
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - findmy_sessions:/data/sessions
    environment:
      - COOKIE_ROOT=/data/sessions
      - INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:?set INTERNAL_SERVICE_TOKEN in your shell or a .env file}

volumes:
  findmy_sessions:
```

Create a repo-root `.gitignore` (there is currently only one inside
`python-findmy-service/`) so a local `.env` file holding the real
`INTERNAL_SERVICE_TOKEN` secret is never committed:

```
# .gitignore (repo root)
.env
```

- [ ] **Step 13: Verify the port binding and env-var requirement manually**

```bash
export INTERNAL_SERVICE_TOKEN=local-dev-token
docker compose build python-findmy-service
docker compose up -d python-findmy-service
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}` (localhost still works — `127.0.0.1:8000:8000`
binds loopback only, which `curl http://localhost:8000` reaches fine).

```bash
docker compose down
unset INTERNAL_SERVICE_TOKEN
docker compose up python-findmy-service
```
Expected: compose refuses to start the container and prints the
`set INTERNAL_SERVICE_TOKEN in your shell or a .env file` message from the
`:?` interpolation — confirming the fail-closed behavior. Run
`docker compose down` afterward regardless of outcome.

- [ ] **Step 14: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "Bind python-findmy-service to localhost only, require INTERNAL_SERVICE_TOKEN"
git push
```

---

## Done criteria

`python-findmy-service` is complete when: `pytest` passes with every test
from Tasks 2–8, the container builds and serves `/health` (Task 7), every
route requires the internal token and 2FA is rate-limited (Task 8), and
Task 1's spike has confirmed (and, if needed, corrected) the `fmf`
response shape the Task 4 fixture and parser assume. At that point the
next plan (spring-bff) can be written against the confirmed
`POST /accounts/login`, `POST /accounts/{apple_id}/2fa`,
`POST /accounts/{apple_id}/people` contract — and spring-bff must send
`X-Internal-Token: <the same INTERNAL_SERVICE_TOKEN>` on every call, or
every request will be rejected with 401.
