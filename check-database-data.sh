#!/bin/bash

# Script pour vérifier les données dans la base de données
# Usage: ./check-database-data.sh [local|remote]

set -e

LOCATION=${1:-local}

if [ "$LOCATION" = "remote" ] || [ "$LOCATION" = "remot" ]; then
    echo "🔍 Vérification des données sur le SERVEUR (Docker)..."
    echo ""
    docker compose exec -T postgres psql -U postgres -d securelink << EOF
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'organisations', COUNT(*) FROM organisations
UNION ALL
SELECT 'forms', COUNT(*) FROM forms
UNION ALL
SELECT 'document_types', COUNT(*) FROM document_types
UNION ALL
SELECT 'verifications', COUNT(*) FROM verifications
UNION ALL
SELECT 'requests', COUNT(*) FROM requests
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'user_documents', COUNT(*) FROM user_documents
UNION ALL
SELECT 'security_settings', COUNT(*) FROM security_settings
UNION ALL
SELECT 'sectors', COUNT(*) FROM sectors
UNION ALL
SELECT 'form_types', COUNT(*) FROM form_types
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
ORDER BY table_name;
EOF
else
    echo "🔍 Vérification des données LOCALES..."
    echo ""
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_USERNAME=${DB_USERNAME:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}
    DB_NAME=${DB_NAME:-securelink}
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME << EOF
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'organisations', COUNT(*) FROM organisations
UNION ALL
SELECT 'forms', COUNT(*) FROM forms
UNION ALL
SELECT 'document_types', COUNT(*) FROM document_types
UNION ALL
SELECT 'verifications', COUNT(*) FROM verifications
UNION ALL
SELECT 'requests', COUNT(*) FROM requests
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'user_documents', COUNT(*) FROM user_documents
UNION ALL
SELECT 'security_settings', COUNT(*) FROM security_settings
UNION ALL
SELECT 'sectors', COUNT(*) FROM sectors
UNION ALL
SELECT 'form_types', COUNT(*) FROM form_types
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
ORDER BY table_name;
EOF
fi

