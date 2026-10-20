#!/usr/bin/env bash
# Crea los roles de mínimo privilegio con contraseñas tomadas del entorno.
# Es un .sh (y no un .sql) porque los .sql de docker-entrypoint-initdb.d no expanden variables.
# Solo se ejecuta cuando el volumen de datos está vacío: tras cambiar contraseñas,
# recrear con `docker compose down -v`.
set -euo pipefail

: "${ETL_DB_PASSWORD:?ETL_DB_PASSWORD es obligatoria}"
: "${API_DB_PASSWORD:?API_DB_PASSWORD es obligatoria}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v etl_password="$ETL_DB_PASSWORD" \
  -v api_password="$API_DB_PASSWORD" <<'SQL'
CREATE ROLE etl_writer LOGIN PASSWORD :'etl_password';
CREATE ROLE api_reader LOGIN PASSWORD :'api_password';
GRANT CONNECT ON DATABASE :"DBNAME" TO etl_writer, api_reader;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
