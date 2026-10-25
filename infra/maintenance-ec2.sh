#!/bin/bash
set -euo pipefail
cd /opt/updish
case "${1:-status}" in
  status)
    docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'
    curl -fsS http://127.0.0.1:8080/actuator/health
    ;;
  domain)
    TOKEN=$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)
    PUBIP=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
    export UPDISH_NEW_DOMAIN="$PUBIP.sslip.io"
    python3 - <<'PY'
import os
from pathlib import Path
path=Path('.env')
lines=[line for line in path.read_text().splitlines() if not line.startswith('API_DOMAIN=')]
path.write_text('\n'.join(lines+['API_DOMAIN='+os.environ['UPDISH_NEW_DOMAIN']])+'\n')
PY
    docker compose up -d --force-recreate proxy
    printf 'API_URL=https://%s.sslip.io\n' "$PUBIP"
    ;;
  backup|restore-check)
    umask 077
    install -d -m 700 backups
    backup="backups/updish-$(date -u +%Y%m%dT%H%M%SZ).dump"
    docker compose exec -T postgres pg_dump -U updish -d updish -Fc > "$backup"
    test -s "$backup"
    sha256sum "$backup"
    if [ "$1" = restore-check ]; then
      checkdb="updish_restore_$(date -u +%s)"
      [[ "$checkdb" =~ ^updish_restore_[0-9]+$ ]]
      docker compose exec -T postgres createdb -U updish "$checkdb"
      trap 'docker compose exec -T postgres dropdb -U updish "$checkdb"' EXIT
      docker compose exec -T postgres pg_restore -U updish -d "$checkdb" --no-owner --exit-on-error < "$backup"
      query="SELECT json_build_array((SELECT run_id FROM demo_state),(SELECT count(*) FROM offering),(SELECT count(*) FROM subscription),(SELECT count(*) FROM holding),(SELECT count(*) FROM settlement),(SELECT count(*) FROM chain_job))::text"
      before=$(docker compose exec -T postgres psql -U updish -d updish -Atc "$query")
      restored=$(docker compose exec -T postgres psql -U updish -d "$checkdb" -Atc "$query")
      test "$before" = "$restored"
      printf 'RESTORE_CHECK=PASS\nROWS_AND_RUN=%s\n' "$restored"
    fi
    ;;
  *) echo 'Use status, domain, backup or restore-check' >&2; exit 2 ;;
esac
