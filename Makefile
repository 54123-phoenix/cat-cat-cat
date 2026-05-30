.PHONY: up down restart ps logs build test frontend-build backend-check clean

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=120

build:
	docker compose build

test: frontend-build backend-check

frontend-build:
	cd cat-frontend && npm run build

backend-check:
	cd cat-backend && python -m compileall app

clean:
	docker compose down --remove-orphans
