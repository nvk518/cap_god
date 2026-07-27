#!/usr/bin/env python3
"""Deterministic NBA player pool cleaner for CAP GOD."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.1.0"
VALID_POSITIONS = frozenset({"PG", "SG", "SF", "PF", "C"})
MIN_MP = 15.0
MIN_RATING = 74
ERA_ORDER = ("2000s", "2010s", "2020s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean NBA player CSV into era JSON pools.")
    parser.add_argument("--input", required=True, type=Path, help="Source CSV path")
    parser.add_argument(
        "--output-dir",
        required=True,
        type=Path,
        help="Directory for era JSON files and manifest",
    )
    parser.add_argument(
        "--positions-file",
        required=True,
        type=Path,
        help="JSON map of player id -> positions list",
    )
    parser.add_argument(
        "--report-file",
        type=Path,
        help="Optional unmatched positions report output",
    )
    return parser.parse_args()


def normalize_player_name(name: str) -> str:
    cleaned = name.replace("\ufeff", "").strip()
    slug = re.sub(r"[^a-z0-9]+", "_", cleaned.lower())
    return slug.strip("_")


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
    raise ValueError(f"unsupported season end year: {year_end}")


def compute_rating(pts: float, ast: float, trb: float) -> int:
    raw = 65 + pts * 0.8 + ast * 0.5 + trb * 0.4
    return min(99, round(raw))


def require_finite_number(value: str, field: str) -> float:
    if value is None or value == "":
        raise ValueError(f"{field} is empty")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{field} is not finite: {value}")
    return number


def require_salary(value: str) -> int:
    number = require_finite_number(value, "salary")
    if number < 0:
        raise ValueError(f"salary must be non-negative: {value}")
    return int(round(number))


def parse_row(row: dict[str, str]) -> dict[str, Any]:
    player = row["Player"].replace("\ufeff", "").strip()
    if not player:
        raise ValueError("player name is empty")

    year_end = int(require_finite_number(row["Year"], "year"))
    pts = require_finite_number(row["PTS"], "pts")
    ast = require_finite_number(row["AST"], "ast")
    trb = require_finite_number(row["TRB"], "trb")
    mp = require_finite_number(row["MP"], "mp")
    games = int(require_finite_number(row["G"], "games"))
    salary = require_salary(row["Salary"])

    if pts < 0 or ast < 0 or trb < 0 or mp < 0:
        raise ValueError(f"negative stat for {player} ({year_end})")

    era = era_for_year_end(year_end)
    record = {
        "id": f"{normalize_player_name(player)}_{year_end}",
        "player": player,
        "year": season_label(year_end),
        "yearEnd": year_end,
        "pts": pts,
        "ast": ast,
        "trb": trb,
        "mp": mp,
        "salary": salary,
        "rating": compute_rating(pts, ast, trb),
        "era": era,
        "_games": games,
    }
    return record


def dedupe_key(record: dict[str, Any]) -> tuple[str, int]:
    return (normalize_player_name(record["player"]), record["yearEnd"])


def pick_better_record(current: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    current_games = current["_games"]
    candidate_games = candidate["_games"]
    if candidate_games != current_games:
        return candidate if candidate_games > current_games else current
    current_mp = current["mp"]
    candidate_mp = candidate["mp"]
    if candidate_mp != current_mp:
        return candidate if candidate_mp > current_mp else current
    return candidate if candidate["salary"] >= current["salary"] else current


def strip_internal_fields(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if not key.startswith("_")}


def sort_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(records, key=lambda record: (record["yearEnd"], record["player"].lower()))


def validate_record(record: dict[str, Any]) -> None:
    required = (
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
    for field in required:
        if field not in record:
            raise ValueError(f"missing field {field}")

    if record["era"] not in ERA_ORDER:
        raise ValueError(f"invalid era: {record['era']}")

    if not re.fullmatch(r"\d{4}-\d{2}", record["year"]):
        raise ValueError(f"invalid year label: {record['year']}")

    for field in ("pts", "ast", "trb", "mp"):
        if not math.isfinite(record[field]):
            raise ValueError(f"non-finite {field} for {record['id']}")

    if record["rating"] < 0 or record["rating"] > 99:
        raise ValueError(f"rating out of range for {record['id']}")

    if record["salary"] < 0:
        raise ValueError(f"negative salary for {record['id']}")

    positions = record["positions"]
    if not isinstance(positions, list) or not positions:
        raise ValueError(f"missing positions for {record['id']}")
    for position in positions:
        if position not in VALID_POSITIONS:
            raise ValueError(f"invalid position {position} for {record['id']}")


def attach_positions(
    records: list[dict[str, Any]],
    positions_map: dict[str, Any],
    report_file: Path | None,
) -> None:
    unmatched: list[dict[str, str]] = []
    for record in records:
        player_id = record["id"]
        raw_positions = positions_map.get(player_id)
        if raw_positions is None:
            unmatched.append(
                {
                    "id": player_id,
                    "player": record["player"],
                    "year": record["year"],
                    "era": record["era"],
                }
            )
            continue
        if not isinstance(raw_positions, list):
            raise ValueError(f"{player_id}: positions must be a list")
        record["positions"] = [str(position) for position in raw_positions]

    if unmatched:
        if report_file:
            report_file.write_text(json.dumps({"unmatched": unmatched}, indent=2) + "\n", encoding="utf-8")
        raise ValueError(f"{len(unmatched)} players missing positions")


def file_checksum(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def write_era_file(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(records, indent=2, ensure_ascii=False) + "\n"
    path.write_text(payload, encoding="utf-8")


def load_csv_rows(input_path: Path) -> list[dict[str, str]]:
    with input_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header row")
        required = {"Player", "Salary", "Year", "G", "MP", "PTS", "AST", "TRB"}
        missing = required - set(reader.fieldnames)
        if missing:
            raise ValueError(f"CSV missing columns: {sorted(missing)}")
        return list(reader)


def clean_players(
    input_path: Path,
    output_dir: Path,
    positions_file: Path,
    report_file: Path | None = None,
) -> dict[str, Any]:
    positions_map = json.loads(positions_file.read_text(encoding="utf-8"))
    if not isinstance(positions_map, dict):
        raise ValueError("positions file must be an object")

    rows = load_csv_rows(input_path)
    deduped: dict[tuple[str, int], dict[str, Any]] = {}

    for row in rows:
        record = parse_row(row)
        if record["mp"] < MIN_MP or record["rating"] < MIN_RATING:
            continue
        key = dedupe_key(record)
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = record
            continue
        deduped[key] = pick_better_record(existing, record)

    records = sort_records([strip_internal_fields(record) for record in deduped.values()])
    attach_positions(records, positions_map, report_file)
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate player ids after cleaning")

    era_records: dict[str, list[dict[str, Any]]] = {era: [] for era in ERA_ORDER}
    for record in records:
        validate_record(record)
        era_records[record["era"]].append(record)

    for era in ERA_ORDER:
        if not era_records[era]:
            raise ValueError(f"era pool is empty: {era}")

    output_dir.mkdir(parents=True, exist_ok=True)
    era_meta: dict[str, Any] = {}
    for era in ERA_ORDER:
        era_path = output_dir / f"{era}.json"
        write_era_file(era_path, era_records[era])
        salaries = [record["salary"] for record in era_records[era]]
        era_meta[era] = {
            "file": f"{era}.json",
            "count": len(era_records[era]),
            "salaryMin": min(salaries),
            "salaryMax": max(salaries),
            "checksumSha256": file_checksum(era_path),
        }

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFile": input_path.name,
        "positionsFile": positions_file.name,
        "positionsChecksumSha256": file_checksum(positions_file),
        "totalPlayers": len(records),
        "minMinutesPlayed": MIN_MP,
        "minRating": MIN_RATING,
        "eras": era_meta,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        print(f"input file not found: {args.input}", file=sys.stderr)
        return 1
    try:
        manifest = clean_players(args.input, args.output_dir, args.positions_file, args.report_file)
    except (ValueError, KeyError, OSError) as error:
        print(f"clean failed: {error}", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "status": "ok",
                "totalPlayers": manifest["totalPlayers"],
                "eras": {era: info["count"] for era, info in manifest["eras"].items()},
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
