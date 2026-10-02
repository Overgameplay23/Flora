#!/usr/bin/env bash
# Usage: test/apply_all.sh <dbname> [extra.sql ...]  — fresh db, shim, all migrations, then extras
set -u
P=${PGHOST_DIR:-/var/tmp/lunapg}; PORT=${PGPORT_NUM:-56432}; DB=$1; shift
psql -h $P -p $PORT -U postgres -qc "drop database if exists $DB" -qc "create database $DB" >/dev/null 2>&1
run() { psql -h $P -p $PORT -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f "$1" > /tmp/apply.out 2>&1 || { echo "FAIL $1"; grep -v NOTICE /tmp/apply.out | head -8; exit 1; }; }
run "$(dirname "$0")/supabase_shim.sql"
for f in "$(dirname "$0")"/../supabase/migrations/*.sql "$@"; do run "$f"; done
echo "applied OK: $(ls "$(dirname "$0")"/../supabase/migrations/*.sql | wc -l) migrations + $# extra"
