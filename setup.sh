#!/bin/bash

set -e

echo "🚀 Yuno AI Agent Orchestration Platform - Setup"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your actual credentials before running docker-compose"
    echo ""
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check for Redis
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found. Make sure Redis is running locally on port 6379"
    echo "   You can install Redis with: brew install redis (on macOS)"
    echo "   Or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your credentials:"
echo "   - SUPABASE_URL and SUPABASE_KEY (from Supabase)"
echo "   - DATABASE_URL (PostgreSQL connection string)"
echo "   - TELEGRAM_BOT_TOKEN (from @BotFather on Telegram)"
echo "   - OPENROUTER_API_KEY (optional, for cloud LLM)"
echo "   - OPENWEATHERMAP_API_KEY (optional, for weather tool)"
echo ""
echo "2. Make sure Redis is running:"
echo "   redis-server"
echo ""
echo "3. Start all services:"
echo "   docker-compose up"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
