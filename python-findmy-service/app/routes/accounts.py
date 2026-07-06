from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import icloud_client
from app.errors import InvalidCredentialsError
from app.security import require_internal_token

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_internal_token)])


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
    try:
        if not icloud_client.submit_2fa(apple_id, body.code):
            raise HTTPException(status_code=400, detail="invalid code")
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="session expired or invalid credentials")
    return {"status": "active"}
