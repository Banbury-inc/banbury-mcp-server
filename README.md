# Banbury Cloud MCP Server

A Model Context Protocol (MCP) server that provides access to Banbury's backend services for LLMs and AI applications.

## Quick Start

### For Frontend Integration (HTTP Mode)

```bash
# Run on default port 3001
./run-http.sh

# Run on custom port
./run-http.sh 8080
```

Then add to your frontend `.env`:
```
REACT_APP_MCP_SERVER_URL=http://localhost:3001
```

### For Claude Desktop (Stdio Mode)

```bash
# Default stdio mode
./run.sh
```

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "banbury-mcp": {
      "command": "/path/to/banbury-mcp-server/run.sh"
    }
  }
}
```

## Transport Modes

### HTTP Transport
- **Use for**: Frontend integration, web applications, API access
- **Port**: Configurable (default: 3001)
- **Endpoints**:
  - `POST /tool` - Execute MCP tools
  - `GET /health` - Server health and info

### Stdio Transport  
- **Use for**: Claude Desktop, direct process communication
- **Communication**: stdin/stdout
- **Integration**: MCP client libraries

## Environment Variables

```bash
# Transport mode: 'http' or 'stdio' (default: stdio)
export MCP_TRANSPORT=http

# HTTP port (default: 3001)  
export MCP_HTTP_PORT=8080

# Banbury environment: 'dev' or 'prod' (default: dev)
export BANBURY_ENV=dev
```

## Available Tools

### Authentication
- `banbury-login` - Authenticate with Banbury credentials

### Device Management  
- `banbury-get-device-info` - Get device information
- `banbury-update-device` - Update device data
- `banbury-declare-online` - Declare device online

### File Management
- `banbury-get-files` - Get files from specific path
- `banbury-get-scanned-folders` - Get scanned folder list

### Task Management
- `banbury-get-sessions` - Get user sessions
- `banbury-add-task` - Add new task

### Model Management
- `banbury-add-model` - Add model to device

### Utility Tools
- `add` - Simple addition (testing)
- `get-joke` - Random joke (entertainment)

## Usage Examples

### HTTP Mode

```bash
# Health check
curl http://localhost:3001/health

# Get a joke
curl -X POST http://localhost:3001/tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "get-joke", "parameters": {}}'

# Login to Banbury  
curl -X POST http://localhost:3001/tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "banbury-login", 
    "parameters": {
      "username": "your-username",
      "password": "your-password",
      "environment": "dev"
    }
  }'

# Get device info using Authorization header
curl -X POST http://localhost:3001/tool \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "tool": "banbury-get-device-info",
    "parameters": {
      "device_name": "your-device",
      "environment": "dev"
    }
  }'

# Get device info using X-API-Key and Authorization Bearer headers
curl -X POST http://localhost:3001/tool \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -H "X-API-Key: your-mcp-server-api-key" \
  -d '{
    "tool": "banbury-get-device-info",
    "parameters": {
      "device_name": "your-device",
      "environment": "dev"
    }
  }'

# Get device info using parameters (legacy method)
curl -X POST http://localhost:3001/tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "banbury-get-device-info",
    "parameters": {
      "token": "your-auth-token", 
      "apiKey": "your-api-key",
      "device_name": "your-device",
      "environment": "dev"
    }
  }'
```

### Frontend Integration

The MCP server integrates seamlessly with the Banbury frontend:

1. Set environment variable: `REACT_APP_MCP_SERVER_URL=http://localhost:3001`
2. The frontend automatically uses stored Banbury credentials
3. Authentication headers are automatically included in all requests:
   - `X-Auth-Token`: User's Banbury token
   - `X-Username`: User's Banbury username
   - `Authorization`: MCP server API key (if configured)
4. AI conversations can call Banbury tools naturally
5. Real-time status indicators show connection/auth state

## Development

### Project Structure
```
banbury-mcp-server/
├── main.ts           # Main server code
├── run.sh           # Stdio mode runner
├── run-http.sh      # HTTP mode runner  
├── package.json     # Dependencies
└── README.md        # Documentation
```

### Adding New Tools

1. Add tool definition in `main.ts`:
```typescript
server.tool("my-new-tool", {
  token: z.string(),
  my_param: z.string(),
  environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, my_param, environment }) => {
  // Implementation
});
```

2. Add HTTP handler case:
```typescript
case 'my-new-tool':
  result = await handleMyNewTool(parameters);
  break;
```

### Testing

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Type checking
npm run type-check
```

## Security

- All Banbury API calls require authentication tokens
- CORS enabled for frontend integration
- No sensitive data logged or cached
- Token validation handled by Banbury backend

## Troubleshooting

### Connection Issues
- Verify the server is running: `curl http://localhost:3001/health`
- Check firewall settings for HTTP mode
- Ensure Banbury backend URLs are accessible

### Authentication Errors  
- Verify Banbury credentials are valid
- Check token hasn't expired
- Ensure proper environment (dev/prod) selection

### Tool Execution Errors
- Check server logs for detailed error messages
- Verify required parameters are provided
- Ensure token has proper permissions

For more help, check the server logs or the Banbury frontend integration guide.

### Authentication Methods

The MCP server supports multiple authentication methods with the following priority order:

1. **Authorization Header**: `Authorization: Bearer <token>` (Primary - matches axios global headers)
2. **X-Auth-Token Header**: `X-Auth-Token: <token>` (Fallback)
3. **X-API-Key Header**: `X-API-Key: <api-key>` (For MCP server API keys)
4. **X-Username Header**: `X-Username: <username>` (For user context)
5. **Request Parameters**: Include `token` and/or `apiKey` in the parameters object (Legacy)

The frontend automatically sends the Banbury user token via `Authorization: Bearer <token>` header, following the same pattern as the axios global headers implementation.