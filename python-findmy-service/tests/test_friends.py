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


def test_parse_people_handles_null_name_fields():
    data = {
        "locations": [{"id": "friend-4", "location": {"latitude": 1.0, "longitude": 2.0, "timestamp": 100}}],
        "contactDetails": [{"id": "friend-4", "firstName": None, "lastName": "Lee"}],
    }

    people = parse_people(data)

    assert people[0].name == "Lee"
    assert "None" not in people[0].name


def test_parse_people_falls_back_to_id_when_all_name_fields_null():
    data = {
        "locations": [{"id": "friend-5", "location": {"latitude": 1.0, "longitude": 2.0, "timestamp": 100}}],
        "contactDetails": [{"id": "friend-5", "firstName": None, "lastName": None}],
    }

    people = parse_people(data)

    assert people[0].name == "friend-5"
