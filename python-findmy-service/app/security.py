import os

from fastapi import Header, HTTPException


def require_internal_token(x_internal_token: str = Header(default="")) -> None:
    expected = os.environ.get("INTERNAL_SERVICE_TOKEN")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="invalid or missing internal token")
