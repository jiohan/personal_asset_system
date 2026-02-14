# Infra (Local Dev)

## Postgres

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

Stop:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env down
```
