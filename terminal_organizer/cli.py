"""Command line interface for the terminal organizer."""

from __future__ import annotations

import argparse
import sys
from typing import List, Sequence

from .board import BoardRenderer
from .config import AppConfig
from .models import Project
from .storage import BoardStorage


def parse_tags(raw: Sequence[str] | None) -> List[str]:
    tags: List[str] = []
    if not raw:
        return tags
    for entry in raw:
        tags.extend([segment.strip().lower() for segment in entry.split(",") if segment.strip()])
    return sorted(set(tags))


def find_project(projects: Sequence[Project], identifier: str) -> Project | None:
    identifier = identifier.strip().lower()
    for project in projects:
        if project.id.lower() == identifier or project.name.lower() == identifier:
            return project
    for project in projects:
        if identifier in project.name.lower():
            return project
    return None


def handle_list(args: argparse.Namespace, config: AppConfig, storage: BoardStorage) -> int:
    projects = storage.load()
    if args.tag:
        tag_filter = args.tag.lower()
        projects = [p for p in projects if tag_filter in p.normalized_tags()]
    statuses = config.statuses
    if args.status:
        requested = {status.strip().lower() for status in args.status}
        statuses = [status for status in config.statuses if status.lower() in requested]
        if not statuses:
            print("No matching statuses to render.")
            return 0
    renderer = BoardRenderer(statuses=statuses)
    board = renderer.render(projects)
    print(board)
    print(f"\n{len(projects)} project(s) shown.")
    return 0


def handle_add(args: argparse.Namespace, config: AppConfig, storage: BoardStorage) -> int:
    status = args.status or config.statuses[0]
    if status.lower() not in {s.lower() for s in config.statuses}:
        print(f"Unknown status '{status}'. Allowed: {', '.join(config.statuses)}")
        return 1
    tags = parse_tags(args.tag)
    project = Project(
        name=args.name,
        repo_path=args.path,
        status=status,
        priority=args.priority,
        tags=tags,
        notes=args.notes or "",
    )
    storage.upsert(project)
    print(f"Created project {project.name} with id {project.id}.")
    return 0


def handle_move(args: argparse.Namespace, config: AppConfig, storage: BoardStorage) -> int:
    projects = storage.load()
    project = find_project(projects, args.identifier)
    if not project:
        print(f"Project '{args.identifier}' not found.")
        return 1
    status = args.status
    if status.lower() not in {s.lower() for s in config.statuses}:
        print(f"Unknown status '{status}'. Allowed: {', '.join(config.statuses)}")
        return 1
    project.status = status
    project.touch()
    storage.upsert(project)
    print(f"Moved '{project.name}' to {status}.")
    return 0


def handle_update(args: argparse.Namespace, config: AppConfig, storage: BoardStorage) -> int:
    projects = storage.load()
    project = find_project(projects, args.identifier)
    if not project:
        print(f"Project '{args.identifier}' not found.")
        return 1
    if args.name:
        project.name = args.name
    if args.path:
        project.repo_path = args.path
    if args.status:
        if args.status.lower() not in {s.lower() for s in config.statuses}:
            print(f"Unknown status '{args.status}'. Allowed: {', '.join(config.statuses)}")
            return 1
        project.status = args.status
    if args.priority:
        project.priority = args.priority
    if args.tag:
        project.tags = parse_tags(args.tag)
    if args.notes is not None:
        project.notes = args.notes
    project.touch()
    storage.upsert(project)
    print(f"Updated project '{project.name}'.")
    return 0


def handle_delete(args: argparse.Namespace, _: AppConfig, storage: BoardStorage) -> int:
    deleted = storage.delete(args.identifier)
    if not deleted:
        print(f"Project '{args.identifier}' not found.")
        return 1
    print("Project deleted.")
    return 0


def handle_info(args: argparse.Namespace, _: AppConfig, storage: BoardStorage) -> int:
    projects = storage.load()
    project = find_project(projects, args.identifier)
    if not project:
        print(f"Project '{args.identifier}' not found.")
        return 1
    print(f"Name      : {project.name}")
    print(f"ID        : {project.id}")
    print(f"Status    : {project.status}")
    print(f"Priority  : {project.priority}")
    print(f"Repo path : {project.repo_path}")
    print(f"Tags      : {', '.join(project.tags) if project.tags else '—'}")
    print(f"Created   : {project.created_at}")
    print(f"Updated   : {project.updated_at}")
    notes = project.notes.strip() or "—"
    print(f"Notes     : {notes}")
    return 0


def build_parser(config: AppConfig) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="terminal-organizer",
        description="Terminal-first project organizer inspired by kanban boards.",
    )
    parser.add_argument(
        "--data",
        default=str(config.store_path),
        help="Path to the JSON storage file (default: %(default)s).",
    )
    subparsers = parser.add_subparsers(dest="command", required=False)

    list_parser = subparsers.add_parser("list", help="Render the kanban board view.")
    list_parser.add_argument("--status", nargs="+", help="Only render these statuses.")
    list_parser.add_argument("--tag", help="Filter projects by tag.")

    add_parser = subparsers.add_parser("add", help="Add a new project card.")
    add_parser.add_argument("--name", required=True)
    add_parser.add_argument("--path", required=True, help="Filesystem path to the repo or workspace.")
    add_parser.add_argument("--status", help="Initial status (default: first configured status).")
    add_parser.add_argument("--priority", type=int, default=3, help="Priority from 1 (high) to 5 (low).")
    add_parser.add_argument("--tag", action="append", help="Comma-separated tags. Repeatable.")
    add_parser.add_argument("--notes", help="Free-form notes shown on the card.")

    move_parser = subparsers.add_parser("move", help="Move an existing project to another column.")
    move_parser.add_argument("identifier", help="Project id or name.")
    move_parser.add_argument("--status", required=True, help="Destination status.")

    update_parser = subparsers.add_parser("update", help="Update project metadata.")
    update_parser.add_argument("identifier", help="Project id or name.")
    update_parser.add_argument("--name")
    update_parser.add_argument("--path")
    update_parser.add_argument("--status")
    update_parser.add_argument("--priority", type=int)
    update_parser.add_argument("--tag", action="append")
    update_parser.add_argument("--notes")

    delete_parser = subparsers.add_parser("delete", help="Delete a project card.")
    delete_parser.add_argument("identifier")

    info_parser = subparsers.add_parser("info", help="Show details for a project.")
    info_parser.add_argument("identifier")

    parser.set_defaults(command="list")
    return parser


def dispatch(args: argparse.Namespace, config: AppConfig) -> int:
    storage = BoardStorage(config.store_path)
    command = args.command or "list"
    if command == "list":
        return handle_list(args, config, storage)
    if command == "add":
        return handle_add(args, config, storage)
    if command == "move":
        return handle_move(args, config, storage)
    if command == "update":
        return handle_update(args, config, storage)
    if command == "delete":
        return handle_delete(args, config, storage)
    if command == "info":
        return handle_info(args, config, storage)
    raise ValueError(f"Unknown command {command}")


def main(argv: Sequence[str] | None = None) -> int:
    config = AppConfig.from_env()
    config.ensure_storage_dir()
    parser = build_parser(config)
    args = parser.parse_args(argv)
    if args.data and args.data != str(config.store_path):
        config.store_path = type(config.store_path)(args.data).expanduser()
        config.ensure_storage_dir()
    return dispatch(args, config)


if __name__ == "__main__":
    sys.exit(main())
