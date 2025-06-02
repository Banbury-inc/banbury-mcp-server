#!/bin/bash

echo "🚀 Starting Banbury Cloud MCP Server v2.0.0"
echo "======================================"
echo ""

# Check environment variables
TRANSPORT_MODE=${MCP_TRANSPORT:-stdio}
HTTP_PORT=${MCP_HTTP_PORT:-3001}

echo "🔧 Configuration:"
echo "   • Transport Mode: $TRANSPORT_MODE"
if [ "$TRANSPORT_MODE" = "http" ]; then
    echo "   • HTTP Port: $HTTP_PORT"
    echo "   • Server URL: http://localhost:$HTTP_PORT"
fi
echo "   • Dev Environment: http://www.api.dev.banbury.io"
echo "   • Prod Environment: http://54.224.116.254:8080"
echo ""

if [ "$TRANSPORT_MODE" = "http" ]; then
    echo "🌐 HTTP Mode - Server will run on port $HTTP_PORT"
    echo "📡 Frontend can connect to: http://localhost:$HTTP_PORT"
    echo "🔗 Use this URL in your REACT_APP_MCP_SERVER_URL"
else
    echo "📡 Stdio Mode - Server communicates via stdin/stdout"
    echo "🔗 This is for direct process communication (Claude Desktop, etc.)"
    echo "⚠️  For frontend integration, use: MCP_TRANSPORT=http ./run.sh"
fi

echo ""
echo "📋 Available Tools:"
echo "   • add - Simple addition"
echo "   • get-joke - Random jokes"
echo "   • banbury-login - Authenticate with Banbury"
echo "   • banbury-get-device-info - Get device information"
echo "   • banbury-update-device - Update device data"
echo "   • banbury-declare-online - Declare device online"
echo "   • banbury-get-files - Get files from path"
echo "   • banbury-get-scanned-folders - Get scanned folders"
echo "   • banbury-get-sessions - Get user sessions"
echo "   • banbury-add-task - Add new task"
echo "   • banbury-add-model - Add model to device"
echo ""

if [ "$TRANSPORT_MODE" = "http" ]; then
    echo "📍 HTTP Endpoints:"
    echo "   • POST /tool - Execute MCP tools"
    echo "   • GET /health - Health check and server info"
    echo ""
fi

echo "💡 Usage Examples:"
if [ "$TRANSPORT_MODE" = "http" ]; then
    echo "   # Health check"
    echo "   curl http://localhost:$HTTP_PORT/health"
    echo ""
    echo "   # Call a tool"
    echo '   curl -X POST http://localhost:'$HTTP_PORT'/tool \'
    echo '        -H "Content-Type: application/json" \'
    echo '        -d '\''{"tool": "get-joke", "parameters": {}}'\'''
else
    echo "   # For Claude Desktop, add to config:"
    echo "   \"banbury-mcp\": {"
    echo "     \"command\": \"$(pwd)/run.sh\""
    echo "   }"
fi

echo ""
echo "Starting server..."
echo "=================="

cd "$(dirname "$0")"
node --loader ts-node/esm main.ts 