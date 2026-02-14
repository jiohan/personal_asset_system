# Bootstrap

## 1) Environment

```bash
bash scripts/check_env.sh
```

## 2) MCP (Codex)
- See `docs/MCP_SETUP.md`

## 3) Local DB

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
```
