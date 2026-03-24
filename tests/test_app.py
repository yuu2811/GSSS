"""Tests for Flask API endpoints."""

import pytest
from app import app, _safe_serialize, _safe_float, _safe_int


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
    assert resp.status_code == 400


def test_analyze_unknown_analyzer(client):
    resp = client.post("/api/analyze", json={"analyzer": "nonexistent", "ticker": "7203.T"})
    assert resp.status_code == 400


def test_analyze_all_missing_ticker(client):
    resp = client.post("/api/analyze_all", json={"ticker": ""})
    assert resp.status_code == 400


def test_analyze_all_no_body(client):
    resp = client.post("/api/analyze_all", content_type="application/json", data="{}")
    assert resp.status_code == 400


def test_search_empty_query(client):
    resp = client.get("/api/search?q=")
    data = resp.get_json()
    assert resp.status_code == 200
    assert isinstance(data.get("results", data), list)


def test_search_no_query_param(client):
    resp = client.get("/api/search")
    data = resp.get_json()
    assert resp.status_code == 200
    assert data["results"] == []


# ── _safe_serialize tests ──

def test_safe_serialize_nan():
    result = _safe_serialize({"val": float("nan")})
    assert result["val"] is None


def test_safe_serialize_inf():
    result = _safe_serialize({"val": float("inf")})
    assert result["val"] is None


def test_safe_serialize_neg_inf():
    result = _safe_serialize({"val": float("-inf")})
    assert result["val"] is None


def test_safe_serialize_normal():
    result = _safe_serialize({"val": 3.14, "list": [1.0, float("nan")]})
    assert result["val"] == 3.14
    assert result["list"] == [1.0, None]


def test_safe_serialize_nested():
    result = _safe_serialize({"a": {"b": float("inf"), "c": 42}})
    assert result["a"]["b"] is None
    assert result["a"]["c"] == 42


# ── _safe_float / _safe_int tests ──

def test_safe_float_normal():
    assert _safe_float("3.14", 0.0) == 3.14


def test_safe_float_invalid():
    assert _safe_float("abc", 1.0) == 1.0


def test_safe_float_none():
    assert _safe_float(None, 2.0) == 2.0


def test_safe_int_normal():
    assert _safe_int("42", 0) == 42


def test_safe_int_invalid():
    assert _safe_int("abc", 10) == 10


def test_safe_int_none():
    assert _safe_int(None, 5) == 5
