# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
FROM python:3.12-slim
LABEL org.opencontainers.image.authors="Adam Krúpa, Ondra Csajka"

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py server.py runner.py ./
RUN useradd --create-home --uid 10001 appuser
USER appuser
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
