from __future__ import annotations

import hashlib
import hmac
import json
import tempfile
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from isolation_api.app import IsolationApiSettings, create_app, sha256_file


class TestIsolationApi(unittest.TestCase):
    def _make_core(self, root: Path) -> tuple[Path, Path]:
        core_dir = root / "core"
        core_dir.mkdir(parents=True, exist_ok=True)
        core_file = core_dir / "core.jsonl"
        core_file.write_text(
            "\n".join(
                [
                    json.dumps({"S1": "CORE-0001", "S2": "acme.widgets"}, separators=(",", ":")),
                    json.dumps({"S1": "CORE-0002", "S2": "acme.widgets"}, separators=(",", ":")),
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        core_sha_file = core_dir / "core.sha256"
        core_sha_file.write_text(f"{sha256_file(core_file)}  core.jsonl\n", encoding="utf-8")
        return core_file, core_sha_file

    def test_core_read_and_hash(self) -> None:
        with tempfile.TemporaryDirectory(prefix="isolation_api_test_") as td:
            root = Path(td)
            data_dir = root / "data"
            core_file, core_sha_file = self._make_core(root)

            settings = IsolationApiSettings(
                data_dir=data_dir,
                core_file=core_file,
                core_sha_file=core_sha_file,
                token_to_namespace={},
                hmac_secrets_by_namespace={},
                require_hmac=False,
                hmac_max_skew_seconds=300,
            )
            client = TestClient(create_app(settings))

            r = client.get("/v1/core/hash")
            self.assertEqual(r.status_code, 200)
            payload = r.json()
            self.assertTrue(payload["matches"])

            r = client.get("/v1/core/read?limit=1")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(len(r.json()["items"]), 1)

    def test_namespace_bound_write(self) -> None:
        with tempfile.TemporaryDirectory(prefix="isolation_api_test_") as td:
            root = Path(td)
            data_dir = root / "data"
            core_file, core_sha_file = self._make_core(root)

            token_a = "token-a"
            token_b = "token-b"
            settings = IsolationApiSettings(
                data_dir=data_dir,
                core_file=core_file,
                core_sha_file=core_sha_file,
                token_to_namespace={token_a: "partner_alpha", token_b: "partner_beta"},
                hmac_secrets_by_namespace={},
                require_hmac=False,
                hmac_max_skew_seconds=300,
            )
            client = TestClient(create_app(settings))

            r = client.post(
                "/v1/agent/entries",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"s_bucket": "S4_EVIDENCE", "payload": {"claim": "x"}},
            )
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["namespace"], "partner_alpha")

            r = client.post(
                "/v1/agent/entries",
                headers={"Authorization": f"Bearer {token_b}"},
                json={"s_bucket": "S4_EVIDENCE", "payload": {"claim": "y"}},
            )
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["namespace"], "partner_beta")

            a_path = data_dir / "agents" / "partner_alpha" / "entries.jsonl"
            b_path = data_dir / "agents" / "partner_beta" / "entries.jsonl"
            self.assertTrue(a_path.exists())
            self.assertTrue(b_path.exists())
            self.assertIn('"namespace":"partner_alpha"', a_path.read_text(encoding="utf-8"))
            self.assertIn('"namespace":"partner_beta"', b_path.read_text(encoding="utf-8"))

    def test_hmac_required_for_writes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="isolation_api_test_") as td:
            root = Path(td)
            data_dir = root / "data"
            core_file, core_sha_file = self._make_core(root)

            token = "token-x"
            ns = "partner_merlin"
            secret = "supersecret"
            settings = IsolationApiSettings(
                data_dir=data_dir,
                core_file=core_file,
                core_sha_file=core_sha_file,
                token_to_namespace={token: ns},
                hmac_secrets_by_namespace={ns: secret},
                require_hmac=True,
                hmac_max_skew_seconds=300,
            )
            client = TestClient(create_app(settings))

            body = json.dumps({"s_bucket": "S4_EVIDENCE", "payload": {"claim": "x"}}, separators=(",", ":")).encode("utf-8")
            ts = int(time.time())
            sig = hmac.new(secret.encode("utf-8"), msg=f"{ts}.".encode("utf-8") + body, digestmod=hashlib.sha256).hexdigest()

            # Missing signature should fail
            r = client.post(
                "/v1/agent/entries",
                headers={"Authorization": f"Bearer {token}"},
                json={"s_bucket": "S4_EVIDENCE", "payload": {"claim": "x"}},
            )
            self.assertEqual(r.status_code, 401)

            # Correct signature should pass (send raw body via data=...)
            r = client.post(
                "/v1/agent/entries",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Timestamp": str(ts),
                    "X-Signature": sig,
                },
                content=body,
            )
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["namespace"], ns)


if __name__ == "__main__":
    unittest.main()

