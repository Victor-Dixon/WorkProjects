# Terminal Organizer

A lightweight terminal-first kanban board that keeps tabs on all of your projects without leaving the command line. Inspired by Kantu-style boards, each column represents a workflow stage and every project card shows repo paths, priority, tags, and notes.

## Features
- Kanban-style layout rendered directly in the terminal with ANSI colors
- Flexible columns via `TERMINAL_ORGANIZER_STATUSES`
- JSON-backed storage with automatic directories
- Fast CLI for adding, moving, updating, deleting, and inspecting projects
- Zero third-party dependencies (pure Python standard library)

## Getting Started
1. Ensure Python 3.10+ is available (`python3 --version`).
2. Clone or copy this repository.
3. (Optional) Create a virtual environment and activate it.
4. Install dependencies (none required, but keep the file up to date):
   ```bash
   pip install -r requirements.txt
   ```

## Usage
Run the CLI via the module entry point:
```bash
python3 -m terminal_organizer [GLOBAL OPTIONS] <command> [ARGS]
```

Common workflows:
- List the board (default command):
  ```bash
  python3 -m terminal_organizer list
  ```
- Add a project:
  ```bash
  python3 -m terminal_organizer add \
    --name "Docs Refresh" \
    --path "$HOME/dev/docs" \
    --status "Backlog" \
    --priority 2 \
    --tag "writing,content" \
    --notes "New IA draft"
  ```
- Move a project to another column:
  ```bash
  python3 -m terminal_organizer move <id-or-name> --status "In Progress"
  ```
- Update metadata:
  ```bash
  python3 -m terminal_organizer update <id> --priority 1 --notes "Ship by Friday"
  ```
- Inspect details:
  ```bash
  python3 -m terminal_organizer info <id-or-name>
  ```
- Delete a card:
  ```bash
  python3 -m terminal_organizer delete <id-or-name>
  ```

## Configuration
Environment variables provide quick customization:
- `TERMINAL_ORGANIZER_DATA`: override the JSON file (default `~/.terminal_organizer/projects.json`).
- `TERMINAL_ORGANIZER_STATUSES`: comma-separated list defining board columns (e.g., `Ideas,Backlog,Doing,Done`).

You can also pass `--data /path/to/file.json` for command-specific overrides. The tool automatically creates the storage directory.

## Development
- Run `python3 -m compileall -q terminal_organizer` to ensure syntax correctness.
- Add automated tests or additional tooling as you evolve the project.
- Contributions: open pull requests describing the workflow changes or new commands.

## Partner-facing API (operational isolation)

This repo also includes a minimal FastAPI service that preserves isolation:

- **Immutable core (read-only)** + hash verification
- **Partner namespace-bound writes** (token → namespace)
- **TLS-ready** (example reverse proxy config)

See `isolation_api/README.md`.
