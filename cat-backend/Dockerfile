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
# The application loads its models on CPU. Avoid unused CUDA runtime downloads.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --retries 5 --timeout 120 \
    --index-url "$TORCH_INDEX_URL" torch==2.6.0 torchvision==0.21.0
RUN pip install --no-cache-dir --retries 5 --timeout 120 \
    -c requirements.txt -r requirements-torch.txt \
    && pip check
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && python -c "import cv2, torch, torchvision, timm; from ultralytics import YOLO"
