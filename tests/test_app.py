"""Tests for Flask API endpoints."""

import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_index(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"html" in resp.data.lower()


def test_analyze_missing_ticker(client):
    resp = client.post("/api/analyze", json={"analyzer": "goldman", "ticker": ""})
    assert resp.status_code == 400


def test_analyze_missing_analyzer(client):
    resp = client.post("/api/analyze", json={"ticker": "7203.T"})
    # Should return 400 for missing analyzer type
    assert resp.status_code == 400


def test_search_empty_query(client):
    resp = client.get("/api/search?q=")
    data = resp.get_json()
    assert resp.status_code == 200
    assert isinstance(data.get("results", data), list)
