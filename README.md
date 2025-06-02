# Banbury MCP Server

A Model Context Protocol (MCP) server that provides tools to interact with the Banbury backend API.

## Features

This MCP server provides comprehensive access to your Banbury backend with the following tool categories:

### Authentication Tools
- **banbury-login**: Authenticate with username/password
- **banbury-auth-status**: Check current authentication status

### Device Management Tools
- **banbury-get-device-info**: Get detailed device information
- **banbury-update-device**: Update device information in the backend
- **banbury-declare-online**: Declare device as online

### File Management Tools
- **banbury-get-files**: Get files from a specific file path
- **banbury-get-scanned-folders**: Get list of scanned folders

### Session/Task Management Tools
- **banbury-get-sessions**: Retrieve session data
- **banbury-add-task**: Add a new task

### Model Management Tools
- **banbury-add-model**: Register a downloaded model for a device

### Demo Tools (Original)
- **add**: Simple addition tool
- **get-joke**: Fetch a random joke

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run the MCP server:
```bash
node main.js
```

## Usage Examples

### Authentication
First, authenticate with your Banbury backend:
```json
{
  "tool": "banbury-login",
  "parameters": {
    "username": "your_username",
    "password": "your_password",
    "environment": "dev"
  }
}
```

Check authentication status:
```json
{
  "tool": "banbury-auth-status",
  "parameters": {}
}
```

### Device Management
Get device information:
```json
{
  "tool": "banbury-get-device-info",
  "parameters": {
    "device_name": "your-device-name",
    "environment": "dev"
  }
}
```

Update device status:
```json
{
  "tool": "banbury-update-device",
  "parameters": {
    "username": "your_username",
    "environment": "dev"
  }
}
```

Declare device online:
```json
{
  "tool": "banbury-declare-online",
  "parameters": {
    "environment": "dev"
  }
}
```

### File Operations
Get files from a path:
```json
{
  "tool": "banbury-get-files",
  "parameters": {
    "file_path": "/path/to/files",
    "environment": "dev"
  }
}
```

Get scanned folders:
```json
{
  "tool": "banbury-get-scanned-folders",
  "parameters": {
    "environment": "dev"
  }
}
```

### Session Management
Get sessions:
```json
{
  "tool": "banbury-get-sessions",
  "parameters": {
    "environment": "dev"
  }
}
```

Add a task:
```json
{
  "tool": "banbury-add-task",
  "parameters": {
    "task_description": "Process new files",
    "environment": "dev"
  }
}
```

### Model Management
Add a model:
```json
{
  "tool": "banbury-add-model",
  "parameters": {
    "device_name": "your-device-name",
    "model_name": "llama2-7b",
    "environment": "dev"
  }
}
```

## Configuration

The server supports both development and production environments:

- **Development**: `http://www.api.dev.banbury.io`
- **Production**: `http://54.224.116.254:8080`

Authentication tokens are automatically stored in `~/.banbury/token` and usernames in `~/.banbury/username` for persistence across sessions.

## Environment Parameters

Most tools accept an `environment` parameter:
- `"dev"` (default): Points to development backend
- `"prod"`: Points to production backend

## Security

- Authentication tokens are stored securely in `~/.banbury/` with restricted file permissions (0o600)
- All API requests use Bearer token authentication when available
- Credentials are automatically loaded from disk for subsequent requests

## Error Handling

All tools include comprehensive error handling and will return descriptive error messages for:
- Authentication failures
- Network errors
- API errors
- Missing parameters

## Testing

Test the server with:
```bash
./test.sh
```

This will test the basic addition tool to ensure the MCP server is working correctly.