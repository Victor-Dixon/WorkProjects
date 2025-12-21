from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field


def _repo_root_from_here() -> Path:
    # /workspace/isolation_api/app.py -> /workspace
    return Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_json_mapping(env_value: str, *, name: str) -> dict[str, str]:
    try:
        raw = json.loads(env_value)
    except json.JSONDecodeError as e:
        raise ValueError(f"{name} must be valid JSON") from e
    if not isinstance(raw, dict):
        raise ValueError(f"{name} must be a JSON object")
    return {str(k): str(v) for k, v in raw.items()}


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    val = os.environ.get(name)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError as e:
        raise ValueError(f"{name} must be an integer") from e


@dataclass(frozen=True)
class IsolationApiSettings:
    """Runtime settings for the Isolation API.

    Token mapping is intentionally token->namespace to make the bound
    namespace lookup O(1) and prevent callers from selecting their own
    namespace on write requests.
    """

    data_dir: Path
    core_file: Path
    core_sha_file: Path
    token_to_namespace: dict[str, str]
    hmac_secrets_by_namespace: dict[str, str]
    require_hmac: bool
    hmac_max_skew_seconds: int

    @staticmethod
    def from_env(repo_root: Path | None = None) -> "IsolationApiSettings":
        repo_root = repo_root or _repo_root_from_here()

        data_dir = Path(os.environ.get("ISOLATION_API_DATA_DIR", str(repo_root / "isolation_api" / "data"))).resolve()
        core_file = Path(
            os.environ.get("ISOLATION_API_CORE_FILE", str(repo_root / "isolation_proof" / "core" / "core.jsonl"))
        ).resolve()
        core_sha_file = Path(
            os.environ.get("ISOLATION_API_CORE_SHA_FILE", str(repo_root / "isolation_proof" / "core" / "core.sha256"))
        ).resolve()

        token_to_namespace = _parse_json_mapping(os.environ.get("ISOLATION_API_TOKENS", "{}"), name="ISOLATION_API_TOKENS")
        hmac_secrets_by_namespace = _parse_json_mapping(
            os.environ.get("ISOLATION_API_HMAC_SECRETS", "{}"), name="ISOLATION_API_HMAC_SECRETS"
        )

        require_hmac = _env_bool("ISOLATION_API_REQUIRE_HMAC", default=False)
        hmac_max_skew_seconds = _env_int("ISOLATION_API_HMAC_MAX_SKEW_SECONDS", default=300)

        return IsolationApiSettings(
            data_dir=data_dir,
            core_file=core_file,
            core_sha_file=core_sha_file,
            token_to_namespace=token_to_namespace,
            hmac_secrets_by_namespace=hmac_secrets_by_namespace,
            require_hmac=require_hmac,
            hmac_max_skew_seconds=hmac_max_skew_seconds,
        )


class Entry(BaseModel):
    s_bucket: str = Field(..., description="Must map back to S1–S7 via projection")
    payload: dict[str, Any]


@dataclass(frozen=True)
class PartnerContext:
    token: str
    namespace: str
    hmac_verified: bool


def _read_pinned_sha256(core_sha_file: Path) -> str:
    # Accept either "hash" or "hash  filename" formats.
    return core_sha_file.read_text(encoding="utf-8").strip().split()[0]


def _agents_root(settings: IsolationApiSettings) -> Path:
    return settings.data_dir / "agents"


def _namespace_dir(settings: IsolationApiSettings, namespace: str) -> Path:
    # Defense-in-depth: keep namespaces as simple directory names.
    if "/" in namespace or "\\" in namespace or namespace in {".", ".."}:
        raise HTTPException(status_code=500, detail="Invalid namespace configuration")
    return _agents_root(settings) / namespace


async def _require_partner(
    request: Request,
    authorization: str = Header(...),
    x_signature: str | None = Header(None, alias="X-Signature"),
    x_timestamp: str | None = Header(None, alias="X-Timestamp"),
) -> PartnerContext:
    settings: IsolationApiSettings = request.app.state.settings

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    namespace = settings.token_to_namespace.get(token)
    if not namespace:
        raise HTTPException(status_code=403, detail="Invalid token")

    # Optional tamper-evidence for writes: HMAC(timestamp + "." + raw_body)
    hmac_verified = False
    if settings.require_hmac:
        secret = settings.hmac_secrets_by_namespace.get(namespace)
        if not secret:
            raise HTTPException(status_code=500, detail="HMAC required but secret not configured")

        if not x_timestamp or not x_signature:
            raise HTTPException(status_code=401, detail="Missing X-Timestamp and/or X-Signature")
        try:
            ts = int(x_timestamp)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid X-Timestamp") from None

        now = int(time.time())
        if abs(now - ts) > settings.hmac_max_skew_seconds:
            raise HTTPException(status_code=401, detail="X-Timestamp outside allowed skew")

        body = await request.body()
        msg = f"{ts}.".encode("utf-8") + body
        expected = hmac.new(secret.encode("utf-8"), msg=msg, digestmod=hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_signature):
            raise HTTPException(status_code=401, detail="Invalid X-Signature")

        request.state.hmac_timestamp = ts
        request.state.hmac_signature = x_signature
        request.state.hmac_alg = "HMAC-SHA256"
        hmac_verified = True

    return PartnerContext(token=token, namespace=namespace, hmac_verified=hmac_verified)


def create_app(settings: IsolationApiSettings | None = None) -> FastAPI:
    settings = settings or IsolationApiSettings.from_env()
    app = FastAPI(title="Isolation API", version="1.0.0")
    app.state.settings = settings

    @app.get("/v1/health")
    def health() -> dict[str, Any]:
        return {"ok": True}

    @app.get("/v1/core/hash")
    def core_hash() -> dict[str, Any]:
        if not settings.core_file.exists() or not settings.core_sha_file.exists():
            raise HTTPException(status_code=500, detail="Core not initialized")

        pinned = _read_pinned_sha256(settings.core_sha_file)
        current = sha256_file(settings.core_file)
        return {
            "core_sha256_current": current,
            "core_sha256_pinned": pinned,
            "matches": pinned == current,
        }

    @app.get("/v1/core/read")
    def core_read(limit: int = 200) -> dict[str, Any]:
        if not settings.core_file.exists():
            raise HTTPException(status_code=500, detail="Core not initialized")
        if limit < 1 or limit > 10_000:
            raise HTTPException(status_code=400, detail="limit out of range")

        out: list[dict[str, Any]] = []
        with settings.core_file.open("r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= limit:
                    break
                out.append(json.loads(line))
        return {"items": out, "limit": limit}

    @app.post("/v1/agent/entries")
    async def write_entry(entry: Entry, request: Request, partner: PartnerContext = Depends(_require_partner)) -> dict[str, Any]:
        agent_dir = _namespace_dir(settings, partner.namespace)
        agent_dir.mkdir(parents=True, exist_ok=True)

        record: dict[str, Any] = {
            "ts": int(time.time()),
            "namespace": partner.namespace,
            "s_bucket": entry.s_bucket,
            "payload": entry.payload,
        }

        if partner.hmac_verified:
            record["hmac"] = {
                "alg": getattr(request.state, "hmac_alg", "HMAC-SHA256"),
                "timestamp": getattr(request.state, "hmac_timestamp", None),
                "signature": getattr(request.state, "hmac_signature", None),
            }

        out_file = (agent_dir / "entries.jsonl").resolve()
        agent_dir_resolved = agent_dir.resolve()
        agents_root = _agents_root(settings).resolve()
        core_dir_resolved = settings.core_file.parent.resolve()

        # Defense-in-depth: ensure writes are inside the bound namespace directory,
        # inside the global agents root, and never inside the core directory.
        try:
            out_file.relative_to(agent_dir_resolved)
        except ValueError as e:
            raise HTTPException(status_code=500, detail="Write path misconfigured (outside namespace dir)") from e

        try:
            out_file.relative_to(agents_root)
        except ValueError as e:
            raise HTTPException(status_code=500, detail="Write path misconfigured (outside agents root)") from e

        try:
            out_file.relative_to(core_dir_resolved)
        except ValueError:
            pass
        else:
            raise HTTPException(status_code=500, detail="Write path misconfigured (core overlap)")

        with out_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

        return {"ok": True, "namespace": partner.namespace}

    @app.get("/v1/aggregate")
    def aggregate(limit: int = 10_000) -> dict[str, Any]:
        if limit < 1 or limit > 200_000:
            raise HTTPException(status_code=400, detail="limit out of range")

        items: list[dict[str, Any]] = []

        # core (read-only)
        if settings.core_file.exists():
            with settings.core_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if len(items) >= limit:
                        break
                    items.append({"source": "core", **json.loads(line)})

        # agents (append-only logs per namespace)
        agents_root = _agents_root(settings)
        if agents_root.exists():
            for ns_dir in agents_root.iterdir():
                if not ns_dir.is_dir():
                    continue
                p = ns_dir / "entries.jsonl"
                if not p.exists() or not p.is_file():
                    continue
                with p.open("r", encoding="utf-8") as f:
                    for line in f:
                        if len(items) >= limit:
                            break
                        items.append({"source": f"agent:{ns_dir.name}", **json.loads(line)})
                if len(items) >= limit:
                    break

        return {"count": len(items), "items": items, "limit": limit}

    return app


# Uvicorn entry-point convenience: `uvicorn isolation_api.app:app`
app = create_app()

