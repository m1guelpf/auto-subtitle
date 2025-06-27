#!/bin/bash

echo "🔄 Reiniciando servicios de Visub..."

# Limpiar cache de Python
echo "🧹 Limpiando cache de Python..."
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Matar procesos existentes
echo "🛑 Deteniendo servicios existentes..."
pkill -f "celery.*webapp" 2>/dev/null || true
pkill -f "uvicorn.*webapp" 2>/dev/null || true

sleep 2

echo "🚀 Iniciando servicios..."

# Verificar si Redis está corriendo
if ! pgrep redis-server > /dev/null; then
    echo "⚠️  Redis no está corriendo. Asegúrate de iniciarlo con: redis-server"
fi

echo "📝 Para iniciar los servicios manualmente:"
echo ""
echo "1. Terminal 1 - Celery Worker:"
echo "   celery -A webapp.celery worker --loglevel=info"
echo ""
echo "2. Terminal 2 - FastAPI Server:"
echo "   uvicorn webapp:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "3. Terminal 3 - Frontend (opcional):"
echo "   cd frontend && npm run dev"
echo ""
echo "✅ Cache limpiado. Los servicios ahora usarán la nueva configuración sin fade animations."