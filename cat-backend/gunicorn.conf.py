# workers=1 is required because SSE (Server-Sent Events) uses an in-process
# pub-sub mechanism; multiple workers would break event broadcasting.
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"
bind = "0.0.0.0:8000"
