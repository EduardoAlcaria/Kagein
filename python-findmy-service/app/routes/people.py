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
