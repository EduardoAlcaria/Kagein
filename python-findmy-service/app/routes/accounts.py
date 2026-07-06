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
