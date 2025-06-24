#!/bin/bash
set -e

echo "🚀 Starting Generator- Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
python wait_for_db.py

if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to database"
    exit 1
fi

# Initialize database tables (creates all tables including users with OAuth fields)
echo "🗄️ Initializing database tables..."
python init_db.py

if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize database tables"
    exit 1
fi

# Verify tables were created
echo "🔍 Verifying database tables..."
python -c "
import os
import psycopg2
from psycopg2 import OperationalError

database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/ideas')
if database_url.startswith('postgresql+asyncpg://'):
    database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    # Check if key tables exist
    tables_to_check = ['users', 'repos', 'ideas', 'user_profiles']
    for table in tables_to_check:
        cursor.execute(f\"SELECT 1 FROM {table} LIMIT 1\")
        print(f'✅ Table {table} exists')
    
    cursor.close()
    conn.close()
    print('✅ All tables verified successfully!')
except Exception as e:
    print(f'❌ Table verification failed: {e}')
    exit(1)
"

if [ $? -ne 0 ]; then
    echo "❌ Database table verification failed"
    exit 1
fi

# Run repo migration (makes repo_id nullable)
echo "📦 Running repo migration..."
python scripts/migrate_repo_id_nullable.py

if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Repo migration failed, continuing anyway..."
fi

# Seed database with sample data
echo "🌱 Seeding database with sample data..."
python scripts/seed_data.py

if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Failed to seed database, continuing anyway..."
fi

# Fetch trending repos from GitHub (but don't generate ideas yet)
echo "📡 Fetching trending repositories from GitHub..."
python scripts/fetch_and_generate_ideas.py --fetch-only

if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Failed to fetch trending repos, continuing anyway..."
fi

# Start the application
echo "🚀 Starting FastAPI application..."
exec python start.py 