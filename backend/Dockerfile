FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY sample_data /app/sample_data
ENV PYTHONPATH=/app/backend
ENV RISKOPTIMA_PLATFORM_DATABASE_PATH=/app/backend/riskoptima_platform.db

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
