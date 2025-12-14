"""Core data models for the terminal organizer."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass(slots=True)
class Project:
    name: str
    repo_path: str
    status: str
    priority: int = 3
    tags: List[str] = field(default_factory=list)
    notes: str = ""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)

    def touch(self) -> None:
        self.updated_at = utc_now()

    def normalized_tags(self) -> List[str]:
        return sorted({tag.strip().lower() for tag in self.tags if tag.strip()})

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["tags"] = self.normalized_tags()
        return data

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Project":
        tags = payload.get("tags") or []
        project = cls(
            id=payload.get("id", uuid.uuid4().hex[:8]),
            name=payload["name"],
            repo_path=payload["repo_path"],
            status=payload.get("status", "Backlog"),
            priority=int(payload.get("priority", 3)),
            tags=tags,
            notes=payload.get("notes", ""),
            created_at=payload.get("created_at", utc_now()),
            updated_at=payload.get("updated_at", utc_now()),
        )
        return project


def serialize_projects(projects: List[Project]) -> str:
    payload = [project.to_dict() for project in projects]
    return json.dumps(payload, indent=2)


def deserialize_projects(blob: str) -> List[Project]:
    if not blob.strip():
        return []
    raw = json.loads(blob)
    return [Project.from_dict(entry) for entry in raw]
