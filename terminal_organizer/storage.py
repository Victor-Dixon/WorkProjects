"""Persistence helpers for terminal organizer projects."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence

from .models import Project, deserialize_projects, serialize_projects


class BoardStorage:
    """Reads and writes project data to a JSON file."""

    def __init__(self, file_path: Path):
        self.file_path = file_path

    def load(self) -> List[Project]:
        if not self.file_path.exists():
            return []
        blob = self.file_path.read_text(encoding="utf-8")
        return deserialize_projects(blob)

    def save(self, projects: Sequence[Project]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = serialize_projects(list(projects))
        self.file_path.write_text(payload + "\n", encoding="utf-8")

    def upsert(self, project: Project) -> None:
        projects = self.load()
        replacements = {p.id: p for p in projects}
        replacements[project.id] = project
        self.save(replacements.values())

    def delete(self, project_id: str) -> bool:
        projects = self.load()
        updated = [p for p in projects if p.id != project_id]
        changed = len(updated) != len(projects)
        if changed:
            self.save(updated)
        return changed
