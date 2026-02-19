SHELL := /usr/bin/env bash

.PHONY: preflight preflight-docker runtime-doctor ai-check \
	dev dev-backend dev-frontend postgres-up \
	test test-backend test-frontend \
	build build-backend build-frontend \
	contract-lint

preflight:
	./scripts/preflight.sh

preflight-docker:
	./scripts/preflight.sh --require-docker

runtime-doctor:
	./scripts/runtime-doctor.sh

ai-check:
	./scripts/ai-check.sh

dev: postgres-up
	./scripts/dev.sh

dev-backend:
	cd backend && \
	if [[ -f .env.local ]]; then set -a && source .env.local && set +a; fi && \
	./mvnw spring-boot:run

dev-frontend:
	cd frontend && npm run dev

postgres-up:
	cd infra && docker compose --env-file .env.example up -d

test: test-backend test-frontend

test-backend:
	cd backend && ./mvnw -B test

test-frontend:
	cd frontend && npm ci && npm run lint && npm run typecheck && npm run test -- --run

build: build-backend build-frontend

build-backend:
	cd backend && ./mvnw -B -DskipTests package

build-frontend:
	cd frontend && npm ci && npm run build

contract-lint:
	npx --yes @redocly/cli@latest lint --max-problems=0 docs/openapi.yaml
