"""Integration tests for artifact creation, upload, and transcription."""

import io
import random

import pytest


@pytest.fixture
async def patient_id(client):
    phone = f"+91 88100 {random.randint(10000, 99999)}"
    resp = await client.post("/patients", json={"name": "Artifact Test", "phone": phone})
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_upload_pdf_artifact(client, patient_id):
    fake_pdf = b"%PDF-1.4 fake pdf content"
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/upload",
        files={"file": ("report.pdf", io.BytesIO(fake_pdf), "application/pdf")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "report"
    assert data["title"] == "report.pdf"
    assert data["patient_id"] == patient_id


@pytest.mark.asyncio
async def test_upload_jpg_artifact(client, patient_id):
    fake_jpg = b"\xff\xd8\xff fake jpeg"
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/upload",
        files={"file": ("ecg.jpg", io.BytesIO(fake_jpg), "image/jpeg")},
    )
    assert resp.status_code == 201
    assert resp.json()["type"] == "image"


@pytest.mark.asyncio
async def test_create_note_artifact(client, patient_id):
    text = "First line becomes title\nSecond line with more detail.\nThird line."
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/note",
        json={"text": text},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "note"
    assert data["title"] == "First line becomes title"
    assert data["text_content"] == text
    assert data["patient_id"] == patient_id


@pytest.mark.asyncio
async def test_note_stored_without_storage_key(client, patient_id):
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/note",
        json={"text": "Quick note."},
    )
    assert resp.status_code == 201
    assert resp.json()["storage_key"] is None


@pytest.mark.asyncio
async def test_list_artifacts_for_patient(client, patient_id):
    await client.post(
        f"/patients/{patient_id}/artifacts/note",
        json={"text": "List test note."},
    )
    resp = await client.get(f"/patients/{patient_id}/artifacts")
    assert resp.status_code == 200
    artifacts = resp.json()
    assert isinstance(artifacts, list)
    assert len(artifacts) >= 1
    assert all(a["patient_id"] == patient_id for a in artifacts)




@pytest.mark.asyncio
async def test_save_audio_artifact(client, patient_id):
    fake_audio = b"\x00" * 2000
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/audio",
        data={"duration_seconds": "45"},
        files={"audio": ("consult.webm", io.BytesIO(fake_audio), "audio/webm")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "audio"
    assert data["duration_seconds"] == 45
    assert data["storage_key"] is not None


@pytest.mark.asyncio
async def test_artifact_download_url(client, patient_id):
    note_resp = await client.post(
        f"/patients/{patient_id}/artifacts/upload",
        files={"file": ("test.pdf", io.BytesIO(b"%PDF fake"), "application/pdf")},
    )
    artifact_id = note_resp.json()["id"]
    resp = await client.get(f"/artifacts/{artifact_id}/download")
    assert resp.status_code == 200
    assert "url" in resp.json()


@pytest.mark.asyncio
async def test_delete_artifact(client, patient_id):
    resp = await client.post(
        f"/patients/{patient_id}/artifacts/note",
        json={"text": "Delete me."},
    )
    artifact_id = resp.json()["id"]
    
    del_resp = await client.delete(f"/artifacts/{artifact_id}")
    assert del_resp.status_code == 204
    
    get_resp = await client.get(f"/artifacts/{artifact_id}")
    assert get_resp.status_code == 404
