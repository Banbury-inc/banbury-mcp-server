# Banbury MCP Server - Cloud Migration Guide

## Overview

This guide documents the migration of the Banbury MCP Server from a local file-system dependent implementation to a cloud-ready service that integrates with the Banbury frontend's credential management system.

## Key Changes Made

### 1. Removed Local Dependencies

**Before:**
- Used local file system to store tokens in `~/.banbury/`
- Relied on `os.hostname()` for device identification
- Had tight coupling with local system resources

**After:**
- All authentication tokens are passed as parameters
- Device names are either provided or generated for cloud instances
- No local file system dependencies

### 2. Updated Tool Signatures

All Banbury tools now require a `token` parameter for authentication:

```typescript
// Before
server.tool("banbury-get-files", {
  file_path: z.string(),
  environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ file_path, environment }) => { ... });

// After
server.tool("banbury-get-files", {
  token: z.string(),
  file_path: z.string(),
  environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, file_path, environment }) => { ... });
```

### 3. New Authentication Flow

**Cloud MCP Server:**
1. Receives token as parameter for each request
2. Uses token to authenticate with Banbury backend
3. Returns results without storing any state locally

**Frontend Integration:**
1. Frontend loads credentials using existing credential system
2. Passes token to cloud MCP server for each tool call
3. MCP server forwards authenticated requests to Banbury backend

## Updated Tool List

### Authentication Tools

#### `banbury-login`
- **Parameters:** `username`, `password`, `environment`
- **Returns:** Login success/failure with token
- **Note:** Token must be saved by the client for future requests

### Device Management Tools

#### `banbury-get-device-info`
- **Parameters:** `token`, `device_name`, `environment`

#### `banbury-update-device`
- **Parameters:** `token`, `username`, `device_name?`, `environment`
- **Note:** `device_name` defaults to a cloud instance identifier if not provided

#### `banbury-declare-online`
- **Parameters:** `token`, `device_name?`, `environment`

### File Management Tools

#### `banbury-get-files`
- **Parameters:** `token`, `file_path`, `environment`

#### `banbury-get-scanned-folders`
- **Parameters:** `token`, `device_name?`, `environment`

### Session/Task Management Tools

#### `banbury-get-sessions`
- **Parameters:** `token`, `environment`

#### `banbury-add-task`
- **Parameters:** `token`, `task_description`, `device_name?`, `environment`

#### `banbury-add-model`
- **Parameters:** `token`, `device_name`, `model_name`, `environment`

## Integration with Frontend Credentials

### Using Existing Credential System

The cloud MCP server is designed to work seamlessly with the existing Banbury frontend credential management:

```typescript
import { loadGlobalAxiosCredentials } from './banbury-frontend/packages/core/src/middleware/axiosGlobalHeader';

// Load credentials from frontend
const { token, username, apiKey } = loadGlobalAxiosCredentials();

// Use with cloud MCP server
const result = await mcpServerCall('banbury-get-files', {
  token: token,
  file_path: '/Users/username/Documents',
  environment: 'dev'
});
```

### Example: Getting 10 Random Files

```typescript
class CloudMcpClient {
  async get10RandomFiles() {
    const { token } = loadGlobalAxiosCredentials();
    
    // Get scanned folders
    const folders = await this.callMcp('banbury-get-scanned-folders', {
      token,
      environment: 'dev'
    });
    
    // Get files from multiple paths
    const randomFiles = [];
    const paths = ['/Documents', '/Desktop', '/Downloads', '/Pictures'];
    
    for (const basePath of folders.scanned_folders) {
      for (const subPath of paths) {
        try {
          const files = await this.callMcp('banbury-get-files', {
            token,
            file_path: basePath + subPath,
            environment: 'dev'
          });
          
          if (files.length > 0) {
            randomFiles.push(...files.slice(0, 2)); // Take 2 from each
          }
        } catch (error) {
          continue; // Skip if path doesn't exist
        }
        
        if (randomFiles.length >= 10) break;
      }
      if (randomFiles.length >= 10) break;
    }
    
    return randomFiles.slice(0, 10);
  }
}
```

## Deployment Considerations

### Environment Variables

The cloud MCP server should be configured with:

```bash
BANBURY_DEV_URL=http://www.api.dev.banbury.io
BANBURY_PROD_URL=http://54.224.116.254:8080
MCP_SERVER_PORT=3000
```

### Authentication

1. **Frontend → Cloud MCP Server:** Use API keys or JWT tokens
2. **Cloud MCP Server → Banbury Backend:** Use user's Banbury token passed from frontend

### Scaling

- The cloud MCP server is now stateless and can be horizontally scaled
- No local storage dependencies mean multiple instances can run concurrently
- Consider implementing connection pooling for Banbury backend requests

## Migration Steps

### For Existing Users

1. **Update tool calls** to include `token` parameter
2. **Remove dependency** on `banbury-auth-status` tool (no longer available)
3. **Handle token management** in the client application
4. **Update device names** to use appropriate identifiers for cloud instances

### For New Deployments

1. Deploy cloud MCP server with no local file system dependencies
2. Configure frontend to pass tokens to cloud MCP server
3. Set up appropriate authentication between frontend and cloud MCP server
4. Monitor and scale based on usage patterns

## Error Handling

### Common Error Scenarios

1. **Missing Token:** All authenticated tools will return error if token not provided
2. **Invalid Token:** Backend will return 401/403 errors for invalid tokens
3. **Network Issues:** Implement retry logic for transient failures
4. **Device Not Found:** Device registration may be required before file operations

### Example Error Handling

```typescript
try {
  const files = await mcpClient.getFiles(token, '/some/path');
} catch (error) {
  if (error.message.includes('401')) {
    // Token expired, redirect to login
    redirectToLogin();
  } else if (error.message.includes('Device not found')) {
    // Register device first
    await mcpClient.updateDevice(token, username, deviceName);
    // Retry operation
  } else {
    // Handle other errors
    console.error('MCP operation failed:', error);
  }
}
```

## Testing

### Unit Tests

Test individual tools with mock tokens and responses:

```typescript
const mockToken = 'test-token-123';
const result = await mcpServer.callTool('banbury-get-files', {
  token: mockToken,
  file_path: '/test/path',
  environment: 'dev'
});
```

### Integration Tests

Test full flow with frontend credential integration:

```typescript
// Mock frontend credentials
jest.mock('./banbury-frontend/packages/core/src/middleware/axiosGlobalHeader', () => ({
  loadGlobalAxiosCredentials: () => ({
    token: 'mock-token',
    username: 'test-user',
    apiKey: 'mock-api-key'
  })
}));

const client = new CloudMcpClient('http://localhost:3000');
const files = await client.get10RandomFiles();
expect(files).toHaveLength(10);
```

## Security Considerations

1. **Token Transmission:** Always use HTTPS for token transmission
2. **Token Storage:** Frontend should securely store tokens (encrypted storage)
3. **Token Rotation:** Implement token refresh logic using existing frontend system
4. **Access Control:** Validate tokens before forwarding to Banbury backend
5. **Rate Limiting:** Implement rate limiting to prevent abuse
6. **Audit Logging:** Log all requests for security monitoring

## Performance Optimizations

1. **Connection Pooling:** Reuse HTTP connections to Banbury backend
2. **Caching:** Cache frequently accessed data (with appropriate TTL)
3. **Batch Requests:** Combine multiple file requests where possible
4. **Async Processing:** Use async/await for all I/O operations
5. **Error Recovery:** Implement exponential backoff for retries

## Monitoring and Observability

### Key Metrics

- Request latency to Banbury backend
- Success/failure rates by tool
- Token validation failures
- Device registration events

### Logging

```typescript
logger.info('MCP tool called', {
  tool: 'banbury-get-files',
  userId: extractUserFromToken(token),
  deviceName,
  environment,
  duration: Date.now() - startTime
});
```

This migration makes the Banbury MCP Server ready for cloud deployment while maintaining full compatibility with the existing Banbury frontend credential management system. 