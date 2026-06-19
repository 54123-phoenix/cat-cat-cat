FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy local SQLite database and uploads at build time
COPY cat_community.db /app/cat_community.db
COPY uploads/ /app/uploads/

RUN mkdir -p uploads/cats uploads/sightings embeddings

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
