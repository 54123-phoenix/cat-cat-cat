Task: Fix the Docker setup to work with SQLite instead of MySQL, and prepare for GitHub sync

Context: The project at D:/Desktop/cat needs to:
1. Make docker-compose.yml use SQLite (which is already what the backend defaults to via DATABASE_URL)
2. The backend Dockerfile needs to include the uploads/cats directory (200 cat photos) and the SQLite DB
3. The data import script has already been run locally, so the DB has 20 cats with 200 photos
4. Local SQLite DB is at: D:/Desktop/cat/cat-backend/cat_community.db
5. Local uploads are at: D:/Desktop/cat/cat-backend/uploads/cats/ (200 jpg files)

Changes to make:

1. Update D:/Desktop/cat/docker-compose.yml:
   - Remove the `db` service entirely (MySQL not needed)
   - Change backend's DATABASE_URL to `sqlite:///./cat_community.db` 
   - Add a volume mount for the uploads directory: `./cat-backend/uploads:/app/uploads`
   - Add a volume mount for the SQLite DB: `./cat-backend/cat_community.db:/app/cat_community.db`
   - Remove the `depends_on: db` and `depends_on: backend condition: service_healthy` (simplify)
   - Remove the healthcheck from backend (keep simple)
   - Frontend vite config should proxy to backend: http://localhost:8000 OR use VITE_API_TARGET

2. Create a D:/Desktop/cat/cat-backend/.dockerignore to exclude venv/ and __pycache__/ from Docker build context

3. Update D:/Desktop/cat/cat-backend/Dockerfile:
   - Remove the torch install line (not needed for demo, slows build)
   - Copy local cat_community.db into the image at build time
   - Copy local uploads/ into the image at build time

4. After changes, test: docker compose build should complete without errors

IMPORTANT: Do NOT change any source code files. Only change Docker-related files.
The goal is a working docker-compose up that shows the app with real cat data.
