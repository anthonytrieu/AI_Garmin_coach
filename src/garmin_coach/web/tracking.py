"""Owner-only tracking with versioned records and atomic, idempotent writes.

Uses a separate SQLite file so existing chat storage is never migrated implicitly.
Private templates are provisioned via GARMIN_COACH_TEMPLATES, never bundled in the UI.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .store import data_dir

router = APIRouter(prefix="/api/tracking", tags=["tracking"])
ROTATION = ["upper-a", "arms-a", "legs", "upper-b", "arms-b", "legs"]
Name = Annotated[str, Field(min_length=1, max_length=120)]
Number = Annotated[float, Field(ge=0, le=100000, allow_inf_nan=False)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SetEntry(Model):
    id: Name
    weight: Number | None = None
    reps: Annotated[int, Field(ge=0, le=10000)] | None = None
    done: bool = False
    edited: bool = False
    warmup: bool = False
    rir: Annotated[int, Field(ge=0, le=20)] | None = None

    @model_validator(mode="after")
    def completed_values(self) -> SetEntry:
        if self.done and (self.weight is None or self.reps is None):
            raise ValueError("Completed sets need weight and reps")
        return self


class Exercise(Model):
    id: Name
    name: Name
    equipment: str = Field(default="", max_length=120)
    convention: str = Field(default="", max_length=80)
    targetMin: int = Field(default=8, ge=1, le=1000)
    targetMax: int = Field(default=10, ge=1, le=1000)
    increment: float = Field(default=5, gt=0, le=1000, allow_inf_nan=False)
    notes: str = Field(default="", max_length=2000)
    sets: list[SetEntry] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def targets(self) -> Exercise:
        if self.targetMin > self.targetMax:
            raise ValueError("Minimum target cannot exceed maximum")
        return self


class Template(Model):
    name: Name
    group: Literal["Upper", "Arms", "Legs", "Custom"]
    exercises: list[Exercise] = Field(min_length=1, max_length=100)


class Workout(Model):
    name: Name
    templateId: str | None = None
    scheduleId: str | None = None
    notes: str = Field(default="", max_length=10000)
    rotationPosition: int | None = Field(default=None, ge=0, le=5)
    date: date
    status: Literal["draft", "completed", "discarded"] = "draft"
    exercises: list[Exercise] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def completed_sets(self) -> Workout:
        if self.status == "completed" and not any(s.done for e in self.exercises for s in e.sets):
            raise ValueError("Complete at least one set before finishing")
        return self


class Meal(Model):
    name: Name
    date: date
    time: str = Field(default="12:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    calories: Number
    protein: Number | None = None
    carbs: Number | None = None
    fat: Number | None = None
    servings: float = Field(gt=0, le=1000, allow_inf_nan=False)
    favourite: bool = False


class Weight(Model):
    date: date
    pounds: float = Field(gt=0, le=2000, allow_inf_nan=False)
    note: str = Field(default="", max_length=2000)


class Ride(Model):
    date: date
    minutes: float = Field(gt=0, le=1440, allow_inf_nan=False)
    note: str = Field(default="", max_length=2000)
    source: Literal["manual"] = "manual"
    externalId: str | None = None


class ScheduledWorkout(Model):
    date: date
    templateId: Name
    name: Name
    rotationPosition: int | None = Field(default=None, ge=0, le=5)


class Note(Model):
    date: date
    text: str = Field(min_length=1, max_length=10000)


class Rotation(Model):
    position: int = Field(ge=0, le=5)


class FoodDay(Model):
    date: date
    complete: bool


MODELS: dict[str, type[BaseModel]] = {
    "template": Template,
    "workout": Workout,
    "meal": Meal,
    "weight": Weight,
    "ride": Ride,
    "food-day": FoodDay,
    "rotation": Rotation,
    "schedule": ScheduledWorkout,
    "note": Note,
}


class Write(Model):
    revision: int = Field(ge=0)
    mutationId: UUID
    data: dict[str, Any] | None


def _connect() -> sqlite3.Connection:
    directory = data_dir()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / "tracking.db"
    conn = sqlite3.connect(path, timeout=10)
    path.chmod(0o600)
    conn.row_factory = sqlite3.Row
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version > 1:
        conn.close()
        raise RuntimeError("Tracking database is newer than this app")
    if version == 0:
        # Back up even an existing empty/unversioned database before applying schema.
        backup = directory / "tracking-before-v1.db"
        if not backup.exists():
            with closing(sqlite3.connect(backup)) as dest:
                conn.backup(dest)
            backup.chmod(0o600)
        conn.executescript("""
            BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL,
                data TEXT, updated TEXT NOT NULL, PRIMARY KEY(kind,id));
            CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, request TEXT, result TEXT);
            CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), position INTEGER);
            INSERT OR IGNORE INTO meta VALUES (1,0);
            PRAGMA user_version=1;
            COMMIT;
        """)
    seed = os.getenv("GARMIN_COACH_TEMPLATES")
    if seed and not conn.execute("SELECT 1 FROM records WHERE kind='template'").fetchone():
        templates = json.loads(Path(seed).read_text())
        with conn:
            for item in templates:
                value = Template.model_validate(item["data"]).model_dump_json()
                conn.execute(
                    "INSERT OR IGNORE INTO records VALUES (?,?,?,?,?)",
                    ("template", item["id"], 1, value, _now()),
                )
    return conn


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _record(row: sqlite3.Row) -> dict[str, Any]:
    return {**dict(row), "data": json.loads(row["data"]) if row["data"] else None}


@router.get("")
def read_all() -> dict[str, Any]:
    with closing(_connect()) as conn:
        return {
            "records": [_record(r) for r in conn.execute("SELECT * FROM records")],
            "position": conn.execute("SELECT position FROM meta WHERE id=1").fetchone()[0],
        }


@router.get("/export")
def export() -> dict[str, Any]:
    return {"schemaVersion": 1, "exportedAt": _now(), **read_all()}


@router.put("/{kind}/{record_id}")
def write(kind: str, record_id: str, body: Write) -> dict[str, Any]:
    if kind not in MODELS or not 1 <= len(record_id) <= 120:
        raise HTTPException(422, "Unknown record type or invalid ID")
    if body.data is not None:
        try:
            value = MODELS[kind].model_validate(body.data).model_dump(mode="json")
        except ValueError as exc:
            raise HTTPException(422, "Invalid tracking entry") from exc
        if kind in {"weight", "food-day"} and record_id != value["date"]:
            raise HTTPException(422, "Daily records must use their local date as ID")
    else:
        value = None
    request = json.dumps([kind, record_id, body.model_dump(mode="json")], sort_keys=True)
    with closing(_connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        prior = conn.execute(
            "SELECT * FROM mutations WHERE id=?", (str(body.mutationId),)
        ).fetchone()
        if prior:
            if prior["request"] != request:
                raise HTTPException(409, "Mutation ID already used for a different write")
            return dict(json.loads(prior["result"]))
        row = conn.execute(
            "SELECT * FROM records WHERE kind=? AND id=?", (kind, record_id)
        ).fetchone()
        if (row["revision"] if row else 0) != body.revision:
            raise HTTPException(
                409, "This record changed elsewhere. Your local draft is preserved."
            )
        old = json.loads(row["data"]) if row and row["data"] else None
        position = conn.execute("SELECT position FROM meta WHERE id=1").fetchone()[0]
        if kind == "rotation":
            if record_id != "current" or value is None:
                raise HTTPException(422, "Rotation requires the current position")
            position = value["position"]
            conn.execute("UPDATE meta SET position=? WHERE id=1", (position,))
        if kind == "workout" and value:
            if value["status"] == "draft":
                other = conn.execute(
                    "SELECT id FROM records WHERE kind='workout' AND id != ? "
                    "AND json_extract(data,'$.status')='draft'",
                    (record_id,),
                ).fetchone()
                if other:
                    raise HTTPException(409, "Resume or discard the existing workout first")
            if old and old["status"] != "draft" and value["status"] == "draft":
                raise HTTPException(
                    409, "Start a new session instead of reopening finished history"
                )
            if value["status"] == "completed" and (
                row is None or (old and old["status"] == "draft")
            ):
                if (
                    value["rotationPosition"] == position
                    and value["templateId"] == ROTATION[position]
                ):
                    position = (position + 1) % len(ROTATION)
                    conn.execute("UPDATE meta SET position=? WHERE id=1", (position,))
        revision = body.revision + 1
        updated = _now()
        conn.execute(
            "INSERT INTO records VALUES (?,?,?,?,?) ON CONFLICT(kind,id) "
            "DO UPDATE SET revision=excluded.revision,data=excluded.data,"
            "updated=excluded.updated",
            (kind, record_id, revision, json.dumps(value) if value else None, updated),
        )
        result = {
            "record": {
                "kind": kind,
                "id": record_id,
                "revision": revision,
                "data": value,
                "updated": updated,
            },
            "position": position,
        }
        conn.execute(
            "INSERT INTO mutations VALUES (?,?,?)",
            (str(body.mutationId), request, json.dumps(result)),
        )
        return result
