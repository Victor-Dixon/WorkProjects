"""Render the kanban-like board layout inside the terminal."""

from __future__ import annotations

import shutil
import textwrap
from typing import Iterable, List, Sequence

from .models import Project

ANSI_RESET = "\033[0m"
ANSI_BLUE = "\033[38;5;39m"
ANSI_GREEN = "\033[38;5;41m"
ANSI_YELLOW = "\033[38;5;178m"
ANSI_MAGENTA = "\033[38;5;169m"
ANSI_CYAN = "\033[38;5;44m"
ANSI_WHITE = "\033[97m"


def _color_for_status(status: str) -> str:
    normalized = status.lower()
    if "idea" in normalized:
        return ANSI_MAGENTA
    if "backlog" in normalized:
        return ANSI_BLUE
    if "progress" in normalized:
        return ANSI_GREEN
    if "review" in normalized:
        return ANSI_CYAN
    if "block" in normalized:
        return ANSI_YELLOW
    if "done" in normalized:
        return ANSI_WHITE
    return ANSI_WHITE


def _wrap(text: str, width: int) -> List[str]:
    return textwrap.wrap(text, width=width, replace_whitespace=False) or [""]


def _format_tags(tags: Sequence[str]) -> str:
    if not tags:
        return ""
    return " ".join(f"#{tag}" for tag in tags)


class BoardRenderer:
    def __init__(self, statuses: Iterable[str], padding: int = 2):
        self.statuses = list(statuses)
        self.padding = padding

    def render(self, projects: Sequence[Project]) -> str:
        terminal_width = shutil.get_terminal_size((120, 24)).columns
        column_width = max(28, (terminal_width - (self.padding * (len(self.statuses) - 1))) // len(self.statuses))
        columns = []
        for status in self.statuses:
            relevant = [p for p in projects if p.status.lower() == status.lower()]
            relevant.sort(key=lambda p: (p.priority, p.name.lower()))
            columns.append(self._build_column(status, relevant, column_width))
        return self._merge_columns(columns, column_width)

    def _build_column(self, status: str, projects: Sequence[Project], width: int) -> List[str]:
        color = _color_for_status(status)
        header = f"{color}{status.upper():^{width}}{ANSI_RESET}"
        lines: List[str] = [header, "─" * width]
        if not projects:
            lines.extend(_wrap("No projects yet", width))
            return lines
        for project in projects:
            lines.extend(self._format_card(project, width))
            lines.append("─" * width)
        return lines[:-1]

    def _format_card(self, project: Project, width: int) -> List[str]:
        tags = _format_tags(project.tags)
        tag_line = tags if len(tags) <= width else tags[: width - 1] + "…"
        header = f"{project.name} ({project.id})"
        header_lines = _wrap(header, width)
        path_line = _wrap(project.repo_path, width)
        note_preview = project.notes.strip().splitlines()[:2]
        note_blob = " ".join(note_preview)
        note_lines = _wrap(note_blob, width) if note_blob else []
        card_lines = header_lines + path_line
        if tags:
            card_lines.append(tag_line)
        card_lines.append(f"Priority: {project.priority}")
        if note_lines:
            card_lines.extend(note_lines)
        return card_lines

    def _merge_columns(self, columns: List[List[str]], width: int) -> str:
        max_rows = max(len(column) for column in columns)
        normalized = [column + [" " * width] * (max_rows - len(column)) for column in columns]
        rows = []
        for row_idx in range(max_rows):
            row = []
            for col_idx, column in enumerate(normalized):
                row.append(column[row_idx].ljust(width))
                if col_idx < len(normalized) - 1:
                    row.append(" " * self.padding)
            rows.append("".join(row).rstrip())
        return "\n".join(rows)
