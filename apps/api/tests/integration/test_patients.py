"""Integration tests for patient CRUD and search."""

import pytest


@pytest.mark.asyncio
async def test_create_patient_valid(client):
    resp = await client.post("/patients", json={"name": "Aanya Sharma", "phone": "+91 98201 44529"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Aanya Sharma"
    assert data["phone_e164"] == "+919820144529"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_patient_10digit_phone(client):
    resp = await client.post("/patients", json={"name": "Rohan Mehta", "phone": "9930081204"})
    assert resp.status_code == 201
    assert resp.json()["phone_e164"] == "+919930081204"


@pytest.mark.asyncio
async def test_create_patient_duplicate_phone_same_clinic_409(client):
    phone = "+91 99100 11001"
    await client.post("/patients", json={"name": "First Patient", "phone": phone})
    resp = await client.post("/patients", json={"name": "Second Patient", "phone": phone})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_patient_invalid_phone_422(client):
    resp = await client.post("/patients", json={"name": "Bad Phone", "phone": "notaphone"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_patient_empty_name_422(client):
    resp = await client.post("/patients", json={"name": "   ", "phone": "+91 99200 00001"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_patients_recent(client):
    await client.post("/patients", json={"name": "Recent Patient", "phone": "+91 99300 00001"})
    resp = await client.get("/patients")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_search_by_name(client):
    await client.post("/patients", json={"name": "Unique Searchable Name", "phone": "+91 99400 00001"})
    resp = await client.get("/patients", params={"q": "Unique Searchable"})
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert any("Unique Searchable" in n for n in names)


@pytest.mark.asyncio
async def test_search_by_phone(client):
    await client.post("/patients", json={"name": "Phone Search Patient", "phone": "+91 99500 55555"})
    resp = await client.get("/patients", params={"q": "99500"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_open_patient_touches_last_accessed(client):
    create = await client.post("/patients", json={"name": "Open Test", "phone": "+91 99600 00001"})
    patient_id = create.json()["id"]
    resp = await client.post(f"/patients/{patient_id}/open")
    assert resp.status_code == 200
    assert resp.json()["id"] == patient_id


@pytest.mark.asyncio
async def test_get_nonexistent_patient_404(client):
    import uuid
    resp = await client.get(f"/patients/{uuid.uuid4()}")
    assert resp.status_code == 404
