# MLflow tracking server with Postgres backend-store + S3 (MinIO) artifact driver.
# The official image lacks psycopg2/boto3, so we add them.
FROM ghcr.io/mlflow/mlflow:v2.19.0

RUN pip install --no-cache-dir psycopg2-binary boto3

EXPOSE 5000
