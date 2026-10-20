FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends hugin-tools enblend && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY services/tour-worker/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home worker
COPY services/tour-worker/stitch.py services/tour-worker/worker.py ./
USER worker
CMD ["python", "worker.py"]
