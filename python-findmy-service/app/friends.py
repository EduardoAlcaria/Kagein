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
