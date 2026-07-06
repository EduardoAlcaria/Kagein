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
