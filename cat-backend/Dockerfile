FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY requirements-torch.txt .
RUN pip install --no-cache-dir -r requirements-torch.txt

COPY . .

RUN mkdir -p data uploads/cats uploads/sightings embeddings models

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "-c", "gunicorn.conf.py"]
