#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y docker.io docker-compose-v2 curl unzip
if ! command -v aws >/dev/null 2>&1; then
  curl -fsS https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip -o /tmp/updish-awscliv2.zip
  unzip -q -o /tmp/updish-awscliv2.zip -d /tmp/updish-awscli
  /tmp/updish-awscli/aws/install --update
fi
systemctl enable --now docker
install -d -m 700 /opt/updish
cd /opt/updish
aws s3 cp s3://__BUCKET__/release/compose.ec2.yaml compose.yaml --region ap-northeast-2 --only-show-errors
aws s3 cp s3://__BUCKET__/release/Caddyfile Caddyfile --region ap-northeast-2 --only-show-errors
aws s3 cp s3://__BUCKET__/release/updish-images.tar.gz images.tar.gz --region ap-northeast-2 --only-show-errors
docker load -i images.tar.gz
TOKEN=$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)
PUBIP=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
umask 077
if ! test -f .env; then
python3 - <<'PY'
import secrets
from pathlib import Path
Path('.env').write_text('POSTGRES_PASSWORD='+secrets.token_hex(24)+'\nAGENT_SHARED_TOKEN='+secrets.token_hex(32)+'\n')
PY
fi
export UPDISH_NEW_DOMAIN="$PUBIP.sslip.io"
python3 - <<'PY'
import os
from pathlib import Path
path=Path('.env')
lines=[line for line in path.read_text().splitlines() if not line.startswith(('API_DOMAIN=','UPDISH_ALLOWED_ORIGINS=','S3_BUCKET=','DEMO_OPERATOR_WALLET='))]
lines += ['API_DOMAIN='+os.environ['UPDISH_NEW_DOMAIN'],'UPDISH_ALLOWED_ORIGINS=__WEB_ORIGIN__','S3_BUCKET=__BUCKET__','DEMO_OPERATOR_WALLET=0x26473024a9118e8f39b1a0ce01ac726c36dd0976']
path.write_text('\n'.join(lines)+'\n')
PY
docker compose up -d
