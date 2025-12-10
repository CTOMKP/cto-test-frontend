#!/bin/bash

echo "🚀 Restoring CHARLY backup..."
echo "================================"

# Stop current processes
echo "🛑 Stopping current processes..."
pkill -f "node server.js" 2>/dev/null
pkill -f "npm start" 2>/dev/null
sleep 2

# Restore from backup
echo "📁 Restoring files from backup..."
cp -r charly_src/* ../src/
cp charly_server.js ../server.js
cp charly_package.json ../package.json
cp charly_env.local ../.env.local
cp charly_user_credentials.json ../user_credentials.json
cp -r charly_public/* ../public/
cp charly_webpack.config.js ../webpack.config.js

echo "✅ Backup restored successfully!"
echo ""
echo "🔄 Next steps:"
echo "1. Run: npm install (if dependencies changed)"
echo "2. Run: node server.js (in one terminal)"
echo "3. Run: npm start (in another terminal)"
echo ""
echo "🎯 Your CHARLY backup is now active!"


