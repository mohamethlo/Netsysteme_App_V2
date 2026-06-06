#!/bin/sh
set -e

# Attend que MySQL accepte les connexions TCP avant de continuer
echo "==> Waiting for database on ${DB_HOST}:${DB_PORT}..."
python << 'EOF'
import socket, time, sys, os

host = os.environ.get('DB_HOST', 'db')
port = int(os.environ.get('DB_PORT', '3306'))

for attempt in range(1, 31):
    try:
        sock = socket.create_connection((host, port), timeout=2)
        sock.close()
        print(f"Database is ready ({host}:{port})")
        sys.exit(0)
    except (socket.error, OSError) as e:
        print(f"  Attempt {attempt}/30: {e} — retrying in 2s...")
        time.sleep(2)

print("Database not reachable after 60s, aborting.")
sys.exit(1)
EOF

echo "==> Applying database migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Starting Gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
