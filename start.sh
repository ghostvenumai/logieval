#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backend
echo "Starting backend..."
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt -q
fi
source .venv/bin/activate
python manage.py migrate --run-syncdb -v 0 2>/dev/null || python manage.py migrate -v 0
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" python manage.py runserver 8000 &
BACKEND_PID=$!

# Frontend
echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install --silent
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "LogiEval running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000/api/"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
