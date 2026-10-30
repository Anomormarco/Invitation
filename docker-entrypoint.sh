#!/bin/sh
set -e

# Optionally sync the DB schema on boot (set RUN_DB_PUSH=1).
# Leave unset in normal runs; use it for the first deploy against a fresh DB.
if [ "${RUN_DB_PUSH:-0}" = "1" ]; then
  echo "› prisma db push"
  npx prisma db push --schema=server/prisma/schema.prisma --skip-generate
fi

exec node server/dist/index.js
