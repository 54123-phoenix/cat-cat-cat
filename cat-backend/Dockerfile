FROM python:3.11-slim AS api

WORKDIR /app

# Use Tsinghua PyPI mirror for faster downloads in China
ARG PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_INDEX_URL=$PIP_INDEX

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 600 -r requirements.txt

COPY . .

RUN mkdir -p data uploads/cats uploads/sightings embeddings models

EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade head && exec gunicorn app.main:app -c gunicorn.conf.py"]

# The API stage supports database/Redis acceptance without model runtimes.
# The default image retains the full inference dependencies.
FROM api AS inference
RUN pip install --no-cache-dir --retries 5 --timeout 600 -r requirements-torch.txt
