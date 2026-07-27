#!/usr/bin/env python3
"""Merge committed season-position data into era player JSON pools."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.1.0"
ERA_ORDER = ("2000s", "2010s", "2020s")
VALID_POSITIONS = frozenset({"PG", "SG", "SF", "PF", "C"})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge season positions into player era JSON.")
    parser.add_argument(
        "--data-dir",
        required=True,
        type=Path,
        help="Directory with era JSON files and manifest.json",
    )
    parser.add_argument(
        "--positions-file",
        required=True,
        type=Path,
        help="JSON map of player id -> list of positions",
    )
    parser.add_argument(
        "--report-file",
        type=Path,
        help="Optional path for unmatched player report JSON",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def file_checksum(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def validate_positions(positions: list[str], player_id: str) -> list[str]:
    if not positions:
        raise ValueError(f"{player_id}: empty positions")
    normalized = []
    for position in positions:
        if position not in VALID_POSITIONS:
            raise ValueError(f"{player_id}: invalid position {position}")
        if position not in normalized:
            normalized.append(position)
    return normalized


def merge_positions(data_dir: Path, positions_file: Path, report_file: Path | None) -> dict[str, Any]:
    positions_map = load_json(positions_file)
    if not isinstance(positions_map, dict):
        raise ValueError("positions file must be an object keyed by player id")

    unmatched: list[dict[str, str]] = []
    era_meta: dict[str, Any] = {}
    total_players = 0

    for era in ERA_ORDER:
        era_path = data_dir / f"{era}.json"
        records = load_json(era_path)
        if not isinstance(records, list):
            raise ValueError(f"{era_path.name}: expected array")

        for record in records:
            player_id = record.get("id")
            if not isinstance(player_id, str):
                raise ValueError(f"{era_path.name}: record missing id")

            raw_positions = positions_map.get(player_id)
            if raw_positions is None:
                unmatched.append(
                    {
                        "id": player_id,
                        "player": str(record.get("player", "")),
                        "year": str(record.get("year", "")),
                        "era": era,
                    }
                )
                continue

            if not isinstance(raw_positions, list):
                raise ValueError(f"{player_id}: positions must be a list")

            record["positions"] = validate_positions([str(item) for item in raw_positions], player_id)

        if unmatched:
            break

        era_path.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        salaries = [record["salary"] for record in records]
        era_meta[era] = {
            "file": f"{era}.json",
            "count": len(records),
            "salaryMin": min(salaries),
            "salaryMax": max(salaries),
            "checksumSha256": file_checksum(era_path),
        }
        total_players += len(records)

    if unmatched:
        if report_file:
            report_file.write_text(json.dumps({"unmatched": unmatched}, indent=2) + "\n", encoding="utf-8")
        raise ValueError(f"{len(unmatched)} players missing positions; see report")

    manifest_path = data_dir / "manifest.json"
    manifest = load_json(manifest_path)
    manifest["schemaVersion"] = SCHEMA_VERSION
    manifest["positionsFile"] = positions_file.name
    manifest["positionsChecksumSha256"] = file_checksum(positions_file)
    manifest["totalPlayers"] = total_players
    manifest["eras"] = era_meta
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "totalPlayers": total_players,
        "eras": {era: info["count"] for era, info in era_meta.items()},
    }


def main() -> int:
    args = parse_args()
    try:
        summary = merge_positions(args.data_dir, args.positions_file, args.report_file)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"merge failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", **summary}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
