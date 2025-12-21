## Partner-facing Isolation API (FastAPI)

This API exposes:

- **Immutable core (read-only)**: `GET /v1/core/hash`, `GET /v1/core/read`
- **Namespace-bound writes**: `POST /v1/agent/entries` (partner token is hard-bound to one namespace)
- **Thin aggregation**: `GET /v1/aggregate` (union of core + all partner namespaces)

### Operational isolation model

- **Core is immutable**: the server returns both the pinned SHA (`core.sha256`) and current SHA of `core.jsonl`.
- **Partners cannot choose a namespace**: the namespace is derived from the bearer token mapping.
- **Partners only append inside their namespace**: writes go to:
  - `${ISOLATION_API_DATA_DIR}/agents/<namespace>/entries.jsonl`

### Configure tokens (namespace binding)

Set `ISOLATION_API_TOKENS` to a JSON object mapping **token → namespace**:

```bash
export ISOLATION_API_TOKENS='{
  "partner_token_value": "partner_merlin"
}'
```

### Optional: tamper-evident writes (HMAC signing)

Enable HMAC verification for write requests:

```bash
export ISOLATION_API_REQUIRE_HMAC=1
export ISOLATION_API_HMAC_SECRETS='{
  "partner_merlin": "supersecret_shared_key"
}'
```

Partner sends:

- `X-Timestamp`: unix seconds
- `X-Signature`: hex HMAC-SHA256 over `"<timestamp>." + <raw_request_body_bytes>`

### Run locally

Install dependencies:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-api.txt
```

Run:

```bash
export PYTHONPATH=.
uvicorn isolation_api.app:app --host 0.0.0.0 --port 8000
```

### TLS (transport encryption)

Terminate TLS in front of Uvicorn (recommended) and reverse proxy to `127.0.0.1:8000`.

See `isolation_api/Caddyfile.example`.

### At-rest encryption

Prefer encrypting the **disk/volume** that backs `ISOLATION_API_DATA_DIR`:

- Cloud disk encryption (EBS / PD / Azure Disk) with KMS-managed keys, or
- LUKS on a VM.

