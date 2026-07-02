.PHONY: dev backend frontend test geo migrate

dev:
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

geo:
	cd frontend && npm run geo:build

test:
	cd backend && pytest -q

migrate:
	@test -n "$(OLD)" || (echo "Usage: make migrate OLD=/path/to/old/project" && exit 1)
	cd backend && python scripts/migrate_data.py $(OLD)
