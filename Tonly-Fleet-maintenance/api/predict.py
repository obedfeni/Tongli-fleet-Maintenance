"""
POST /api/predict

Body:
  {
    "readings": [{ "truckId": "ET001", "rowRef": 18, "date": "2026-08-15T00:00:00.000Z" | null, "odometerKm": 12442 }, ...],
    "asOfDate": "2026-08-31T00:00:00.000Z"
  }

Response:
  {
    "predictions": [ { "truckId": ..., "currentOdometerKm": ..., "avgDailyKm": ..., ... }, ... ],
    "algorithm": "RANSAC linear regression (scikit-learn), OLS refit on inliers",
    "computedAt": "..."
  }

This file is intentionally a thin HTTP wrapper — all the actual statistics
live in _ml_core.py (not itself a route: files starting with "_" are ignored
by Vercel's file-based Python function routing).
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

from _ml_core import Reading, run_predictions

MAX_BODY_BYTES = 15 * 1024 * 1024  # charging logs can run to ~1,500 rows


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # Python's fromisoformat doesn't accept a trailing "Z" before 3.11's
        # handling improvements landed everywhere we might run — normalize it.
        v = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # CORS preflight, harmless for same-origin use
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        self._send_json(
            200,
            {
                "ok": True,
                "message": "POST a { readings, asOfDate } body to run predictions.",
            },
        )

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_BODY_BYTES:
                self._send_json(400, {"error": "Request body missing or too large."})
                return

            raw = self.rfile.read(length)
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            self._send_json(400, {"error": "Request body must be valid JSON."})
            return

        readings_payload = body.get("readings")
        if not isinstance(readings_payload, list) or len(readings_payload) == 0:
            self._send_json(400, {"error": "'readings' must be a non-empty array."})
            return

        by_truck: dict[str, list[Reading]] = defaultdict(list)
        for item in readings_payload:
            try:
                truck_id = str(item["truckId"])
                row_ref = int(item["rowRef"])
                odometer_km = float(item["odometerKm"])
            except (KeyError, TypeError, ValueError):
                continue  # skip malformed rows rather than fail the whole batch
            date = _parse_iso(item.get("date"))
            by_truck[truck_id].append(Reading(row_ref=row_ref, date=date, odometer_km=odometer_km))

        if not by_truck:
            self._send_json(400, {"error": "No valid readings found in request body."})
            return

        try:
            predictions = run_predictions(by_truck)
        except Exception as exc:  # noqa: BLE001 — surface a clean 500 instead of a crash trace
            self._send_json(500, {"error": f"Prediction engine failed: {exc}"})
            return

        self._send_json(
            200,
            {
                "predictions": predictions,
                "algorithm": "RANSAC linear regression (scikit-learn), OLS refit on inliers",
                "computedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
