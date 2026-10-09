# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
FROM python:3.12-slim
LABEL org.opencontainers.image.authors="Adam Krúpa, Ondra Csajka"

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./
RUN useradd --uid 10001 --create-home relay
USER relay
CMD ["python", "main.py"]
