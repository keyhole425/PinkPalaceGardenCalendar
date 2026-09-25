#!/bin/sh
# Bring the database up to date, then serve.
#
# Seeding is safe to run on every start: it only ever touches rows it still
# owns, so a first boot fills an empty volume and every boot after that is a
# no-op unless the seed itself has changed.
set -e

echo "figgy: migrating ${GARDEN_DB_PATH}"
node_modules/.bin/tsx db/migrate.ts

echo "figgy: seeding"
node_modules/.bin/tsx db/seed/run.ts

echo "figgy: serving on ${HOSTNAME}:${PORT}"
exec node server.js
