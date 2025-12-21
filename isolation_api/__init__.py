"""Partner-facing Isolation API (FastAPI).

This package exposes an immutable "core" dataset read surface plus
namespace-bound partner write endpoints that append to per-namespace
JSONL logs under a data directory.
"""

from .app import create_app

__all__ = ["create_app"]

