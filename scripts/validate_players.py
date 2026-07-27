#!/usr/bin/env python3
"""Independent validator for CAP GOD player era JSON files."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

SUPPORTED_SCHEMA_VERSION = "1.1.0"
ERA_ORDER = ("2000s", "2010s", "2020s")
VALID_POSITIONS = frozenset({"PG", "SG", "SF", "PF", "C"})
REQUIRED_FIELDS = (
    "id",
    "player",
    "year",
    "yearEnd",
    "pts",
    "ast",
    "trb",
    "mp",
    "salary",
    "rating",
    "era",
    "positions",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate generated player era JSON files.")
    parser.add_argument(
        "--data-dir",
        required=True,
        type=Path,
        help="Directory containing manifest.json and era files",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        fail(f"{path.name}: invalid JSON ({error})")


def season_label(year_end: int) -> str:
    start = year_end - 1
    return f"{start}-{year_end % 100:02d}"


def era_for_year_end(year_end: int) -> str:
    season_start = year_end - 1
    if year_end == 2000:
        return "2000s"
    if 2000 <= season_start <= 2009:
        return "2000s"
    if 2010 <= season_start <= 2019:
        return "2010s"
    if season_start >= 2020:
        return "2020s"
    fail(f"unsupported yearEnd: {year_end}")
    return "2000s"


def compute_rating(pts: float, ast: float, trb: float) -> int:
    raw = 65 + pts * 0.8 + ast * 0.5 + trb * 0.4
    return min(99, round(raw))


def validate_record(record: dict[str, Any], path_name: str, index: int) -> None:
    prefix = f"{path_name}[{index}]"
    if not isinstance(record, dict):
        fail(f"{prefix}: record is not an object")

    for field in REQUIRED_FIELDS:
        if field not in record:
            fail(f"{prefix}: missing field {field}")

    if not isinstance(record["id"], str) or not record["id"]:
        fail(f"{prefix}: invalid id")

    if not isinstance(record["player"], str) or not record["player"].strip():
        fail(f"{prefix}: invalid player name")

    if record["era"] not in ERA_ORDER:
        fail(f"{prefix}: invalid era {record['era']}")

    if record["year"] != season_label(int(record["yearEnd"])):
        fail(f"{prefix}: year label mismatch")

    if era_for_year_end(int(record["yearEnd"])) != record["era"]:
        fail(f"{prefix}: era mismatch for yearEnd")

    if not re.fullmatch(r"\d{4}-\d{2}", record["year"]):
        fail(f"{prefix}: invalid year format")

    for field in ("pts", "ast", "trb", "mp"):
        value = record[field]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            fail(f"{prefix}: invalid {field}")

    salary = record["salary"]
    if not isinstance(salary, int) or salary < 0:
        fail(f"{prefix}: invalid salary")

    rating = record["rating"]
    if not isinstance(rating, int) or rating < 0 or rating > 99:
        fail(f"{prefix}: invalid rating")

    expected_rating = compute_rating(record["pts"], record["ast"], record["trb"])
    if rating != expected_rating:
        fail(f"{prefix}: rating mismatch (expected {expected_rating}, got {rating})")

    positions = record["positions"]
    if not isinstance(positions, list) or not positions:
        fail(f"{prefix}: invalid positions")
    normalized_positions: list[str] = []
    for position in positions:
        if not isinstance(position, str) or position not in VALID_POSITIONS:
            fail(f"{prefix}: invalid position {position}")
        if position not in normalized_positions:
            normalized_positions.append(position)


def validate_sorted(records: list[dict[str, Any]], path_name: str) -> None:
    keys = [(record["yearEnd"], record["player"].lower()) for record in records]
    if keys != sorted(keys):
        fail(f"{path_name}: records are not sorted by yearEnd then player")


def file_checksum(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def validate_era_file(path: Path) -> dict[str, Any]:
    payload = load_json(path)
    if not isinstance(payload, list):
        fail(f"{path.name}: expected array")

    if not payload:
        fail(f"{path.name}: empty era pool")

    ids: set[str] = set()
    for index, record in enumerate(payload):
        validate_record(record, path.name, index)
        player_id = record["id"]
        if player_id in ids:
            fail(f"{path.name}: duplicate id {player_id}")
        ids.add(player_id)

    validate_sorted(payload, path.name)
    salaries = [record["salary"] for record in payload]
    return {
        "count": len(payload),
        "salaryMin": min(salaries),
        "salaryMax": max(salaries),
        "checksumSha256": file_checksum(path),
    }


def validate_manifest(data_dir: Path) -> dict[str, Any]:
    manifest_path = data_dir / "manifest.json"
    if not manifest_path.is_file():
        fail("manifest.json not found")

    manifest = load_json(manifest_path)
    if not isinstance(manifest, dict):
        fail("manifest.json must be an object")

    schema_version = manifest.get("schemaVersion")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        fail(f"unsupported schemaVersion: {schema_version}")

    positions_checksum = manifest.get("positionsChecksumSha256")
    if not isinstance(positions_checksum, str) or not positions_checksum:
        fail("manifest missing positionsChecksumSha256")

    eras = manifest.get("eras")
    if not isinstance(eras, dict):
        fail("manifest eras must be an object")

    summary: dict[str, Any] = {"totalPlayers": 0, "eras": {}}
    for era in ERA_ORDER:
        era_info = eras.get(era)
        if not isinstance(era_info, dict):
            fail(f"manifest missing era block: {era}")

        era_path = data_dir / str(era_info.get("file", f"{era}.json"))
        if not era_path.is_file():
            fail(f"missing era file: {era_path.name}")

        observed = validate_era_file(era_path)
        summary["eras"][era] = {
            "count": observed["count"],
            "salaryMin": observed["salaryMin"],
            "salaryMax": observed["salaryMax"],
        }
        summary["totalPlayers"] += observed["count"]

        if era_info.get("count") != observed["count"]:
            fail(f"{era}: manifest count mismatch")

        if era_info.get("salaryMin") != observed["salaryMin"]:
            fail(f"{era}: manifest salaryMin mismatch")

        if era_info.get("salaryMax") != observed["salaryMax"]:
            fail(f"{era}: manifest salaryMax mismatch")

        expected_checksum = era_info.get("checksumSha256")
        if not isinstance(expected_checksum, str) or not expected_checksum:
            fail(f"{era}: manifest missing checksumSha256")

        if expected_checksum != observed["checksumSha256"]:
            fail(f"{era}: checksum mismatch")

    manifest_total = manifest.get("totalPlayers")
    if manifest_total != summary["totalPlayers"]:
        fail("manifest totalPlayers mismatch")

    return summary


def main() -> int:
    args = parse_args()
    if not args.data_dir.is_dir():
        print(f"data directory not found: {args.data_dir}", file=sys.stderr)
        return 1
    try:
        summary = validate_manifest(args.data_dir)
    except ValueError as error:
        print(f"validation failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", **summary}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
