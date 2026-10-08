FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY orchestrator/ ./orchestrator/
COPY gatekeeper/ ./gatekeeper/
COPY examiner/ ./examiner/
COPY policy/ ./policy/
COPY seed_skills/ ./seed_skills/
COPY datasets/ ./datasets/
COPY scripts/verify_audit.py scripts/llm_smoke.py scripts/live_test.py ./scripts/
RUN useradd --create-home --uid 10001 appuser && mkdir -p /data && chown appuser:appuser /data
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"

CMD ["uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000", "--ws", "websockets", "--ws-ping-interval", "20", "--ws-ping-timeout", "20"]
