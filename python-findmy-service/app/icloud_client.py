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
    try:
        api = PyiCloudService(apple_id, cookie_directory=cookie_directory_for(apple_id))
    except PyiCloudFailedLoginException as exc:
        raise InvalidCredentialsError(str(exc)) from exc
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
