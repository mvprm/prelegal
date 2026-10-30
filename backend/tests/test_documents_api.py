from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_chat import NDA, TODAY

NDA_VALUES = NDA.default_values(TODAY) | {"purpose": "Evaluating a partnership", "party1.company": "Acme Inc"}


def save(client: TestClient, id: str, document_id: str = "mutual-nda", **values: str) -> Any:
    return client.put(f"/api/documents/{id}", json={"documentId": document_id, "values": values or NDA_VALUES})


def test_saving_creates_then_updates_a_document(user_client: TestClient) -> None:
    id = str(uuid4())

    created = save(user_client, id)
    assert created.status_code == 200
    assert created.json()["id"] == id
    assert created.json()["documentId"] == "mutual-nda"
    assert created.json()["values"] == NDA_VALUES

    updated = save(user_client, id, **(NDA_VALUES | {"party2.company": "Globex LLC"}))
    assert updated.json()["values"]["party2.company"] == "Globex LLC"
    assert updated.json()["createdAt"] == created.json()["createdAt"]
    assert updated.json()["updatedAt"] >= created.json()["updatedAt"]

    assert user_client.get(f"/api/documents/{id}").json() == updated.json()
    assert user_client.get("/api/documents").json() == [updated.json()]
    assert updated.json()["title"] is None


def rename(client: TestClient, id: str, title: str) -> Any:
    return client.patch(f"/api/documents/{id}", json={"title": title})


def test_renaming_a_document(user_client: TestClient) -> None:
    id = str(uuid4())
    saved = save(user_client, id).json()

    renamed = rename(user_client, id, "  Acme NDA  ")

    assert renamed.status_code == 200
    assert renamed.json() == saved | {"title": "Acme NDA"}  # trimmed, and not counted as an update
    assert user_client.get(f"/api/documents/{id}").json()["title"] == "Acme NDA"
    assert user_client.get("/api/documents").json()[0]["title"] == "Acme NDA"


@pytest.mark.parametrize("title", ["", "   "])
def test_an_empty_name_goes_back_to_the_default(user_client: TestClient, title: str) -> None:
    id = str(uuid4())
    save(user_client, id)
    rename(user_client, id, "Acme NDA")

    assert rename(user_client, id, title).json()["title"] is None


def test_saving_keeps_the_name(user_client: TestClient) -> None:
    # The browser saves automatically, so a save sent before a rename may arrive after it.
    id = str(uuid4())
    save(user_client, id)
    rename(user_client, id, "Acme NDA")

    response = save(user_client, id, **(NDA_VALUES | {"party2.company": "Globex LLC"}))

    assert response.json()["title"] == "Acme NDA"
    assert response.json()["values"]["party2.company"] == "Globex LLC"


def test_names_are_at_most_120_characters(user_client: TestClient) -> None:
    id = str(uuid4())
    save(user_client, id)

    too_long = rename(user_client, id, "x" * 121)
    assert too_long.status_code == 422
    assert too_long.json() == {"detail": "The name can be at most 120 characters long."}
    assert rename(user_client, id, f" {'x' * 120} ").json()["title"] == "x" * 120


@pytest.mark.parametrize("body", [{}, {"title": None}, {"title": 5}])
def test_renaming_validates_the_request(user_client: TestClient, body: dict[str, Any]) -> None:
    id = str(uuid4())
    save(user_client, id)
    assert user_client.patch(f"/api/documents/{id}", json=body).status_code == 422


def test_renaming_a_missing_document(user_client: TestClient) -> None:
    response = rename(user_client, str(uuid4()), "Acme NDA")
    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


def test_saving_fills_in_missing_fields_as_empty(user_client: TestClient) -> None:
    response = save(user_client, str(uuid4()), governingLaw="Delaware")
    values = response.json()["values"]
    assert set(values) == set(NDA.all_fields)
    assert values["governingLaw"] == "Delaware"
    assert values["purpose"] == ""


def test_a_document_can_change_kind(user_client: TestClient) -> None:
    id = str(uuid4())
    save(user_client, id)
    response = save(user_client, id, "pilot-agreement", **{"party1.company": "Acme Inc"})
    assert response.json()["documentId"] == "pilot-agreement"
    assert len(user_client.get("/api/documents").json()) == 1


def test_documents_are_listed_most_recent_first(user_client: TestClient) -> None:
    first, second = str(uuid4()), str(uuid4())
    save(user_client, first)
    save(user_client, second)
    save(user_client, first)
    assert [document["id"] for document in user_client.get("/api/documents").json()] == [first, second]


def test_deleting_a_document(user_client: TestClient) -> None:
    id = str(uuid4())
    save(user_client, id)

    assert user_client.delete(f"/api/documents/{id}").status_code == 204

    assert user_client.get(f"/api/documents/{id}").status_code == 404
    assert user_client.get("/api/documents").json() == []
    assert user_client.delete(f"/api/documents/{id}").status_code == 404


def test_users_cannot_see_or_change_each_others_documents(user_client: TestClient, other_client: TestClient) -> None:
    id = str(uuid4())
    save(user_client, id)

    assert other_client.get("/api/documents").json() == []
    for response in [
        other_client.get(f"/api/documents/{id}"),
        save(other_client, id, **{"purpose": "Taken over"}),
        rename(other_client, id, "Taken over"),
        other_client.delete(f"/api/documents/{id}"),
    ]:
        assert response.status_code == 404
        assert response.json() == {"detail": "Document not found"}
    assert user_client.get(f"/api/documents/{id}").json()["values"] == NDA_VALUES
    assert user_client.get(f"/api/documents/{id}").json()["title"] is None


@pytest.mark.parametrize(
    ("document_id", "values", "detail"),
    [
        ("employment-contract", {}, "Unknown document 'employment-contract'"),
        ("mutual-nda", {"salary": "1"}, "Unknown fields: salary"),
    ],
)
def test_saving_rejects_unknown_documents_and_fields(
    user_client: TestClient, document_id: str, values: dict[str, str], detail: str
) -> None:
    response = user_client.put(f"/api/documents/{uuid4()}", json={"documentId": document_id, "values": values})
    assert response.status_code == 422
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize(
    "body",
    [
        {"values": {}},
        {"documentId": "mutual-nda"},
        {"documentId": "mutual-nda", "values": {"purpose": "x" * 5001}},
        {"documentId": "mutual-nda", "values": {"mndaTermYears": 2}},
    ],
)
def test_saving_validates_the_request(user_client: TestClient, body: dict[str, Any]) -> None:
    assert user_client.put(f"/api/documents/{uuid4()}", json=body).status_code == 422


def test_ids_must_be_uuids(user_client: TestClient) -> None:
    assert user_client.get("/api/documents/1").status_code == 422
    assert save(user_client, "../users").status_code in (404, 422)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/documents"),
        ("GET", f"/api/documents/{uuid4()}"),
        ("PUT", f"/api/documents/{uuid4()}"),
        ("PATCH", f"/api/documents/{uuid4()}"),
        ("DELETE", f"/api/documents/{uuid4()}"),
    ],
)
def test_documents_need_a_signed_in_user(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={"documentId": "mutual-nda", "values": {}, "title": "Acme NDA"})
    assert response.status_code == 401
