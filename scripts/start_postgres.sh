#!/bin/bash
# Self-healing PostgreSQL launcher for the preview container: fixes ownership (UIDs can change
# across pod restarts), clears a stale pid, then runs postgres as the postgres user.
set -e
PGDATA=/app/pgdata
LOGS=/app/pglogs
mkdir -p "$LOGS"
chown -R postgres:postgres "$PGDATA" "$LOGS"
chmod 700 "$PGDATA"
if [ -f "$PGDATA/postmaster.pid" ] && ! kill -0 "$(head -1 "$PGDATA/postmaster.pid")" 2>/dev/null; then
  rm -f "$PGDATA/postmaster.pid"
fi
exec su postgres -s /bin/bash -c "/usr/lib/postgresql/15/bin/postgres -D $PGDATA -p 5432 -c listen_addresses=localhost"
