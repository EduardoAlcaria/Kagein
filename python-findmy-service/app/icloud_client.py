import time
from typing import Optional

from pyicloud import PyiCloudService
from pyicloud.exceptions import PyiCloudFailedLoginException

from app.cookies import cookie_directory_for
from app.errors import InvalidCredentialsError, TooManyAttemptsError, TwoFactorRequiredError
from app.friends import fetch_people
from app.models import Person

MAX_2FA_ATTEMPTS = 5
TWO_FA_LOCKOUT_WINDOW_SECONDS = 15 * 60
_failed_2fa_attempts: dict[str, list[float]] = {}


def _recent_2fa_failures(apple_id: str) -> list[float]:
    now = time.time()
    recent = [t for t in _failed_2fa_attempts.get(apple_id, []) if now - t < TWO_FA_LOCKOUT_WINDOW_SECONDS]
    _failed_2fa_attempts[apple_id] = recent
    return recent


def login(apple_id: str, password: str) -> str:
    try:
        api = PyiCloudService(apple_id, password, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
    return "2fa_required" if api.requires_2fa else "active"


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


def get_people(apple_id: str, password: Optional[str] = None) -> list[Person]:
    try:
        api = PyiCloudService(apple_id, password, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
    if api.requires_2fa:
        raise TwoFactorRequiredError(apple_id)
    return fetch_people(api)
