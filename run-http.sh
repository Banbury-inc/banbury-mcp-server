#!/bin/bash

# Run the Banbury MCP Server in HTTP mode for frontend integration
export MCP_TRANSPORT=http
export MCP_HTTP_PORT=${1:-3001}

echo "🌐 Starting Banbury MCP Server in HTTP mode"
echo "🔧 Port: $MCP_HTTP_PORT"
echo "📡 Frontend URL: http://localhost:$MCP_HTTP_PORT"
echo ""
echo "Add this to your .env file:"
echo "REACT_APP_MCP_SERVER_URL=http://localhost:$MCP_HTTP_PORT"
echo ""

./run.sh 