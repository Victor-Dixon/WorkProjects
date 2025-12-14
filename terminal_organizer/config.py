"""Application configuration helpers for the terminal organizer."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Iterable, List


DEFAULT_STATUSES: List[str] = [
    "Ideas",
    "Backlog",
    "In Progress",
    "Review",
    "Blocked",
    "Done",
]


def _parse_statuses(raw: str | None) -> List[str]:
    if not raw:
        return DEFAULT_STATUSES
    statuses = [segment.strip() for segment in raw.split(",")]
    cleaned = [s for s in statuses if s]
    return cleaned or DEFAULT_STATUSES


def _resolve_store_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser().resolve()
    return Path.home() / ".terminal_organizer" / "projects.json"


@dataclass(slots=True)
class AppConfig:
    statuses: List[str]
    store_path: Path

    @classmethod
    def from_env(cls) -> "AppConfig":
        statuses = _parse_statuses(os.environ.get("TERMINAL_ORGANIZER_STATUSES"))
        store_path = _resolve_store_path(os.environ.get("TERMINAL_ORGANIZER_DATA"))
        return cls(statuses=statuses, store_path=store_path)

    def ensure_storage_dir(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)


def iter_statuses(custom_sequence: Iterable[str] | None = None) -> List[str]:
    statuses = list(custom_sequence) if custom_sequence else DEFAULT_STATUSES
    return statuses or DEFAULT_STATUSES
