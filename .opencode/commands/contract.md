Run contract-first sync check for this repository.

Focus:
- Compare `docs/openapi.yaml` with implemented controllers/DTO/error responses.
- Report:
  1) Spec exists but implementation missing
  2) Implementation exists but spec missing
  3) Error code/response schema mismatches

Output format:
- Severity (`high|medium|low`)
- Endpoint
- Evidence file path
- Recommended fix order
