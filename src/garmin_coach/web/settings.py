"""Private configuration is loaded at runtime, never bundled in the demo."""

import os
from pathlib import Path


def plan_dir() -> Path:
    return Path(os.environ.get("GARMIN_COACH_PLAN_DIR", ".local/training")).expanduser()


def athlete_context() -> str:
    path = Path(os.environ.get("GARMIN_COACH_PROFILE", ".local/athlete.md")).expanduser()
    return (
        path.read_text()[:4000]
        if path.is_file()
        else "No athlete profile configured. Ask for goals."
    )
