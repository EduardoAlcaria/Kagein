from typing import Optional

from pydantic import BaseModel


class Person(BaseModel):
    id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp_ms: Optional[int] = None
