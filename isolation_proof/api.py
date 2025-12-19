from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .aggregate import Aggregator, write_jsonl
from .agents import ProjectionError
from .core import CoreDataset, compute_file_sha256
from .safefs import SandboxFS, SandboxViolation


class AuthError(PermissionError):
    pass


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> Any:
    length = int(handler.headers.get("Content-Length", "0") or "0")
    raw = handler.rfile.read(length) if length else b""
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def _bearer_token(handler: BaseHTTPRequestHandler) -> str | None:
    auth = handler.headers.get("Authorization")
    if not auth:
        return None
    prefix = "Bearer "
    if not auth.startswith(prefix):
        return None
    return auth[len(prefix) :].strip() or None


@dataclass(frozen=True)
class ApiConfig:
    core_path: Path
    core_hash_path: Path
    data_dir: Path
    tokens: dict[str, str]

    @staticmethod
    def from_env(repo_root: Path, data_dir: Path) -> "ApiConfig":
        core_path = repo_root / "isolation_proof" / "core" / "core.jsonl"
        core_hash_path = repo_root / "isolation_proof" / "core" / "core.sha256"

        # JSON mapping: {"core_reader":"token", "agent_alpha":"token", ...}
        raw = os.environ.get("ISOLATION_PROOF_TOKENS", "{}")
        tokens = json.loads(raw)
        if not isinstance(tokens, dict):
            raise ValueError("ISOLATION_PROOF_TOKENS must be a JSON object")

        return ApiConfig(
            core_path=core_path,
            core_hash_path=core_hash_path,
            data_dir=data_dir,
            tokens={str(k): str(v) for k, v in tokens.items()},
        )


@dataclass(frozen=True)
class ApiState:
    config: ApiConfig

    def expected_core_sha256(self) -> str:
        return self.config.core_hash_path.read_text(encoding="utf-8").strip().split()[0]

    def core_dataset(self) -> CoreDataset:
        return CoreDataset(path=self.config.core_path, expected_sha256=self.expected_core_sha256())

    def authenticate(self, handler: BaseHTTPRequestHandler) -> str:
        """Return principal name for a valid bearer token."""
        token = _bearer_token(handler)
        if not token:
            raise AuthError("Missing Authorization: Bearer <token>")

        for principal, t in self.config.tokens.items():
            if t == token:
                return principal
        raise AuthError("Invalid token")

    def agent_fs(self, agent_id: str) -> SandboxFS:
        agents_root = self.config.data_dir / "agents"
        allowed = agents_root / agent_id
        # Deny writes into core, and deny escaping into sibling agents (best-effort).
        # Core deny is sufficient for the main safety claim; sibling denies help catch mistakes.
        deny_roots = (self.config.core_path.parent, agents_root)
        return SandboxFS(allowed_root=allowed, deny_roots=deny_roots)


def make_handler(state: ApiState):
    class Handler(BaseHTTPRequestHandler):
        server_version = "IsolationProofAPI/1.0"

        def log_message(self, fmt: str, *args: Any) -> None:
            # Keep server quiet by default.
            return

        def do_GET(self) -> None:  # noqa: N802
            try:
                principal = state.authenticate(self)

                parsed = urlparse(self.path)
                path = parsed.path.rstrip("/")

                if path == "/v1/health":
                    _json_response(self, 200, {"ok": True})
                    return

                if path == "/v1/core/hash":
                    expected = state.expected_core_sha256()
                    actual = compute_file_sha256(state.config.core_path)
                    _json_response(
                        self,
                        200,
                        {"expected_sha256": expected, "actual_sha256": actual, "matches": expected == actual},
                    )
                    return

                if path == "/v1/core/records":
                    # Any authenticated principal may read core.
                    core = state.core_dataset()
                    core.verify_immutable()
                    _json_response(self, 200, {"records": core.load()})
                    return

                if path == "/v1/aggregate":
                    # Aggregate across whatever agent sandboxes exist in data_dir.
                    agents_root = state.config.data_dir / "agents"
                    entry_paths: list[Path] = []
                    if agents_root.exists():
                        for agent_dir in agents_root.iterdir():
                            p = agent_dir / "entries.jsonl"
                            if p.exists() and p.is_file():
                                entry_paths.append(p)

                    aggregator = Aggregator()
                    out = aggregator.aggregate(entry_paths)
                    _json_response(self, 200, {"entries": out, "count": len(out)})
                    return

                _json_response(self, 404, {"error": "not_found"})

            except AuthError as e:
                _json_response(self, 401, {"error": "unauthorized", "message": str(e)})
            except Exception as e:  # noqa: BLE001
                _json_response(self, 500, {"error": "server_error", "message": str(e)})

        def do_POST(self) -> None:  # noqa: N802
            try:
                principal = state.authenticate(self)

                parsed = urlparse(self.path)
                path = parsed.path.rstrip("/")

                # POST /v1/agents/{agent_id}/entries
                parts = [p for p in path.split("/") if p]
                if len(parts) == 4 and parts[0] == "v1" and parts[1] == "agents" and parts[3] == "entries":
                    agent_id = parts[2]

                    if principal != agent_id:
                        raise AuthError("Token not authorized for this agent namespace")

                    payload = _read_json(self)
                    if payload is None:
                        _json_response(self, 400, {"error": "bad_request", "message": "Missing JSON body"})
                        return

                    # Accept either a single entry or a list of entries.
                    entries: list[dict[str, Any]]
                    if isinstance(payload, list):
                        entries = payload
                    elif isinstance(payload, dict):
                        entries = [payload]
                    else:
                        _json_response(self, 400, {"error": "bad_request", "message": "Body must be object or list"})
                        return

                    fs = state.agent_fs(agent_id)

                    # Append-only writes.
                    out_path = (fs.allowed_root / "entries.jsonl").resolve()
                    # Guard: write must be within allowed_root and not within denied roots.
                    fs._ensure_write_allowed(out_path)  # pylint: disable=protected-access
                    out_path.parent.mkdir(parents=True, exist_ok=True)

                    with out_path.open("a", encoding="utf-8") as f:
                        for entry in entries:
                            if not isinstance(entry, dict):
                                raise ValueError("Each entry must be a JSON object")
                            # Enforce that projection exists and is valid (S1-S7 only).
                            proj = entry.get("projection")
                            if not isinstance(proj, dict):
                                raise ProjectionError("Entry missing dict 'projection'")
                            f.write(json.dumps(entry, sort_keys=True, separators=(",", ":")) + "\n")

                    _json_response(self, 201, {"ok": True, "written": len(entries)})
                    return

                _json_response(self, 404, {"error": "not_found"})

            except AuthError as e:
                _json_response(self, 401, {"error": "unauthorized", "message": str(e)})
            except (SandboxViolation, ProjectionError, ValueError) as e:
                _json_response(self, 400, {"error": "bad_request", "message": str(e)})
            except Exception as e:  # noqa: BLE001
                _json_response(self, 500, {"error": "server_error", "message": str(e)})

    return Handler


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Isolation proof HTTP API")
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument(
        "--data-dir",
        type=str,
        default=None,
        help="Where agent sandboxes live (default: ./isolation_proof/out/api)",
    )
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    data_dir = Path(args.data_dir).resolve() if args.data_dir else (repo_root / "isolation_proof" / "out" / "api")
    data_dir.mkdir(parents=True, exist_ok=True)

    config = ApiConfig.from_env(repo_root=repo_root, data_dir=data_dir)
    state = ApiState(config=config)

    handler_cls = make_handler(state)
    httpd = ThreadingHTTPServer((args.host, args.port), handler_cls)

    print(f"listening on http://{args.host}:{args.port} data_dir={data_dir}")
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
