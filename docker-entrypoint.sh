#!/bin/sh
set -e

# Attendre que PostgreSQL soit prêt (si DB_HOST est défini)
if [ -n "${DB_HOST}" ]; then
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT:-5432}..."
  until nc -z "${DB_HOST}" "${DB_PORT:-5432}"; do
    sleep 1
  done
  echo "PostgreSQL is ready."
fi

# Démarrer l'application NestJS
exec node dist/main.js
