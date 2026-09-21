#!/bin/sh
set -eu

: "${PORT:=10000}"
export PORT

envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
