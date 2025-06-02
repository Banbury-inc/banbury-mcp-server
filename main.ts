import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import * as http from "http";

// Configuration for Banbury backend
const BANBURY_CONFIG = {
  dev: {
    url: 'http://www.api.dev.banbury.io',
    ws_url: 'ws://www.api.dev.banbury.io/ws/consumer/'
  },
  prod: {
    url: 'http://54.224.116.254:8080',
    ws_url: 'ws://54.224.116.254:8082'
  }
};

// Check for transport mode
const TRANSPORT_MODE = process.env.MCP_TRANSPORT || 'stdio'; // 'stdio' or 'http'
const HTTP_PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : 3001;

// Helper function for making authenticated requests
async function makeAuthenticatedRequest(url: string, token: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

// Helper function for making unauthenticated requests (like login)
async function makeRequest(url: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

// Create an MCP server
const server = new McpServer({
  name: "Banbury Cloud MCP Server",
  version: "2.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a get-joke tool
server.tool("get-joke",
  {},
  async () => {
    try {
      const response = await fetch("https://official-joke-api.appspot.com/random_joke");
      const joke = await response.json() as { setup: string; punchline: string };
      return {
        content: [{ 
          type: "text", 
          text: `${joke.setup}\n${joke.punchline}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: "Sorry, couldn't fetch a joke right now!" 
        }]
      };
    }
  }
);

// Banbury Authentication Tools
server.tool("banbury-login",
  {
    username: z.string(),
    password: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ username, password, environment }) => {
    try {
      const env = environment as keyof typeof BANBURY_CONFIG;
      const baseUrl = BANBURY_CONFIG[env].url;
      const url = `${baseUrl}/authentication/getuserinfo4/${username}/${password}`;
      
      const response = await makeRequest(url);
      const data = await response.json() as any;
      
      if (data.result === 'success') {
        return {
          content: [{
            type: "text",
            text: `✅ Successfully logged in as ${username}\nToken: ${data.token}\nUser Info: ${JSON.stringify(data.user_info, null, 2)}\n\n⚠️  Save this token for future requests!`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Login failed: ${data.message || 'Invalid credentials'}`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Device Management Tools
server.tool("banbury-get-device-info",
  {
    token: z.string(),
    device_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, device_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/devices/get_single_device_info_with_device_name/${device_name}`;
      
      const response = await makeAuthenticatedRequest(url, token);
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Device Info for ${device_name}:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error fetching device info: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.tool("banbury-update-device",
  {
    token: z.string(),
    username: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, username, device_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/devices/update_devices/${username}/`;
      
      // Use provided device name or default to a cloud instance identifier
      const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
      
      const deviceInfo = {
        user: username,
        device_number: 0,
        device_name: actualDeviceName,
        files: [], // Would be populated based on user's actual files
        date_added: new Date().toISOString(),
      };
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify(deviceInfo)
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Device update result: ${data.response || JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error updating device: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.tool("banbury-declare-online",
  {
    token: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, device_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/devices/declare_online/`;
      
      // Use provided device name or default to a cloud instance identifier
      const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({ device_name: actualDeviceName })
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Declare online result: ${data.result || JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error declaring device online: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// File Management Tools
server.tool("banbury-get-files",
  {
    token: z.string(),
    file_path: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, file_path, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/files/get_files_from_filepath/`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({ global_file_path: file_path })
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Files from ${file_path}:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error fetching files: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.tool("banbury-get-scanned-folders",
  {
    token: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, device_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/files/get_scanned_folders/`;
      
      // Use provided device name or default
      const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({ device_name: actualDeviceName })
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Scanned folders:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error fetching scanned folders: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Session/Task Management Tools
server.tool("banbury-get-sessions",
  {
    token: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/sessions/get_session/`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Sessions:\n${JSON.stringify(data.sessions || data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error fetching sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.tool("banbury-add-task",
  {
    token: z.string(),
    task_description: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, task_description, device_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/tasks/add_task/`;
      
      // Use provided device name or default
      const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({
          task_name: task_description,
          task_device: actualDeviceName,
          task_progress: 0,
          task_status: 'pending'
        })
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Task added:\n${JSON.stringify(data.taskInfo || data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error adding task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Model Management Tool
server.tool("banbury-add-model",
  {
    token: z.string(),
    device_name: z.string(),
    model_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
  },
  async ({ token, device_name, model_name, environment }) => {
    try {
      const baseUrl = BANBURY_CONFIG[environment].url;
      const url = `${baseUrl}/devices/add_downloaded_model/`;
      
      const response = await makeAuthenticatedRequest(url, token, {
        method: 'POST',
        body: JSON.stringify({
          device_name,
          model_name
        })
      });
      
      const data = await response.json() as any;
      
      return {
        content: [{
          type: "text",
          text: `Model added:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error adding model: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Add a review-code prompt
server.prompt(
  "review-code",
  { code: z.string() },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);

// Add a summarize-text prompt
server.prompt(
  "summarize-text",
  { text: z.string() },
  ({ text }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Summarize the following:\n\n${text}`
      }
    }]
  })
);

// Add a joke-summary prompt
server.prompt(
  "joke-summary",
  {},
  async () => {
    // Fetch a random joke from an API
    const response = await fetch("https://official-joke-api.appspot.com/random_joke");
    // Explicitly type the joke object
    const joke = await response.json() as { setup: string; punchline: string };

    // Construct the prompt message
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Here's a joke for you:\n\n${joke.setup}\n${joke.punchline}\n\nCan you summarize this joke in one sentence?`
        }
      }]
    };
  }
);

// Start the server with appropriate transport
async function startServer() {
  if (TRANSPORT_MODE === 'http') {
    // HTTP Transport (for cloud deployment and frontend integration)
    console.log(`🌐 Starting HTTP MCP Server on port ${HTTP_PORT}`);
    console.log(`📡 Server URL: http://localhost:${HTTP_PORT}`);
    console.log(`🔗 Use this URL in your frontend MCP client configuration`);
    
    const httpServer = http.createServer(async (req: any, res: any) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.method === 'POST' && req.url === '/tool') {
        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', async () => {
          try {
            const { tool, parameters } = JSON.parse(body);
            
            // Map tool calls to direct function calls
            let result;
            switch (tool) {
              case 'add':
                const { a, b } = parameters;
                result = { content: [{ type: "text", text: String(a + b) }] };
                break;
                
              case 'get-joke':
                try {
                  const response = await fetch("https://official-joke-api.appspot.com/random_joke");
                  const joke = await response.json() as { setup: string; punchline: string };
                  result = { content: [{ type: "text", text: `${joke.setup}\n${joke.punchline}` }] };
                } catch (error) {
                  result = { content: [{ type: "text", text: "Sorry, couldn't fetch a joke right now!" }] };
                }
                break;
                
              case 'banbury-login':
                const { username, password, environment = 'dev' } = parameters;
                try {
                  const env = environment as keyof typeof BANBURY_CONFIG;
                  const baseUrl = BANBURY_CONFIG[env].url;
                  const url = `${baseUrl}/authentication/getuserinfo4/${username}/${password}`;
                  const response = await makeRequest(url);
                  const data = await response.json() as any;
                  
                  if (data.result === 'success') {
                    result = { content: [{ type: "text", text: `✅ Successfully logged in as ${username}\nToken: ${data.token}\nUser Info: ${JSON.stringify(data.user_info, null, 2)}\n\n⚠️  Save this token for future requests!` }] };
                  } else {
                    result = { content: [{ type: "text", text: `❌ Login failed: ${data.message || 'Invalid credentials'}` }] };
                  }
                } catch (error) {
                  result = { content: [{ type: "text", text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
                }
                break;
                
              default:
                // Handle other Banbury tools that require authentication
                if (tool.startsWith('banbury-')) {
                  result = await handleBanburyTool(tool, parameters);
                } else {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Tool ${tool} not found` }));
                  return;
                }
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          version: '2.0.0',
          transport: 'http',
          port: HTTP_PORT,
          availableTools: [
            'add', 'get-joke', 'banbury-login', 'banbury-get-device-info',
            'banbury-update-device', 'banbury-declare-online', 'banbury-get-files',
            'banbury-get-scanned-folders', 'banbury-get-sessions', 'banbury-add-task',
            'banbury-add-model'
          ]
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    
    httpServer.listen(HTTP_PORT, () => {
      console.log(`✅ HTTP MCP Server is running on http://localhost:${HTTP_PORT}`);
      console.log(`📋 Available endpoints:`);
      console.log(`   • POST /tool - Execute MCP tools`);
      console.log(`   • GET /health - Health check`);
    });
    
  } else {
    // Stdio Transport (for direct process communication)
    console.log(`📡 Starting Stdio MCP Server`);
    console.log(`🔗 This server communicates via stdin/stdout`);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log(`✅ Stdio MCP Server connected and ready`);
  }
}

// Helper function to handle authenticated Banbury tools
async function handleBanburyTool(tool: string, parameters: any): Promise<any> {
  const { token, environment = 'dev' } = parameters;
  const env = environment as keyof typeof BANBURY_CONFIG;
  const baseUrl = BANBURY_CONFIG[env].url;
  
  try {
    switch (tool) {
      case 'banbury-get-device-info':
        const { device_name } = parameters;
        const deviceUrl = `${baseUrl}/devices/get_single_device_info_with_device_name/${device_name}`;
        const deviceResponse = await makeAuthenticatedRequest(deviceUrl, token);
        const deviceData = await deviceResponse.json() as any;
        return { content: [{ type: "text", text: `Device Info for ${device_name}:\n${JSON.stringify(deviceData, null, 2)}` }] };
        
      case 'banbury-update-device':
        const { username, device_name: updateDeviceName } = parameters;
        const updateUrl = `${baseUrl}/devices/update_devices/${username}/`;
        const actualDeviceName = updateDeviceName || `cloud-mcp-${Date.now()}`;
        const deviceInfo = {
          user: username,
          device_number: 0,
          device_name: actualDeviceName,
          files: [],
          date_added: new Date().toISOString(),
        };
        const updateResponse = await makeAuthenticatedRequest(updateUrl, token, {
          method: 'POST',
          body: JSON.stringify(deviceInfo)
        });
        const updateData = await updateResponse.json() as any;
        return { content: [{ type: "text", text: `Device update result: ${updateData.response || JSON.stringify(updateData, null, 2)}` }] };
        
      case 'banbury-declare-online':
        const { device_name: onlineDeviceName } = parameters;
        const onlineUrl = `${baseUrl}/devices/declare_online/`;
        const actualOnlineDeviceName = onlineDeviceName || `cloud-mcp-${Date.now()}`;
        const onlineResponse = await makeAuthenticatedRequest(onlineUrl, token, {
          method: 'POST',
          body: JSON.stringify({ device_name: actualOnlineDeviceName })
        });
        const onlineData = await onlineResponse.json() as any;
        return { content: [{ type: "text", text: `Declare online result: ${onlineData.result || JSON.stringify(onlineData, null, 2)}` }] };
        
      case 'banbury-get-files':
        const { file_path } = parameters;
        const filesUrl = `${baseUrl}/files/get_files_from_filepath/`;
        const filesResponse = await makeAuthenticatedRequest(filesUrl, token, {
          method: 'POST',
          body: JSON.stringify({ global_file_path: file_path })
        });
        const filesData = await filesResponse.json() as any;
        return { content: [{ type: "text", text: `Files from ${file_path}:\n${JSON.stringify(filesData, null, 2)}` }] };
        
      case 'banbury-get-scanned-folders':
        const { device_name: scanDeviceName } = parameters;
        const scanUrl = `${baseUrl}/files/get_scanned_folders/`;
        const actualScanDeviceName = scanDeviceName || `cloud-mcp-${Date.now()}`;
        const scanResponse = await makeAuthenticatedRequest(scanUrl, token, {
          method: 'POST',
          body: JSON.stringify({ device_name: actualScanDeviceName })
        });
        const scanData = await scanResponse.json() as any;
        return { content: [{ type: "text", text: `Scanned folders:\n${JSON.stringify(scanData, null, 2)}` }] };
        
      case 'banbury-get-sessions':
        const sessionsUrl = `${baseUrl}/sessions/get_session/`;
        const sessionsResponse = await makeAuthenticatedRequest(sessionsUrl, token, {
          method: 'POST',
          body: JSON.stringify({})
        });
        const sessionsData = await sessionsResponse.json() as any;
        return { content: [{ type: "text", text: `Sessions:\n${JSON.stringify(sessionsData.sessions || sessionsData, null, 2)}` }] };
        
      case 'banbury-add-task':
        const { task_description, device_name: taskDeviceName } = parameters;
        const taskUrl = `${baseUrl}/tasks/add_task/`;
        const actualTaskDeviceName = taskDeviceName || `cloud-mcp-${Date.now()}`;
        const taskResponse = await makeAuthenticatedRequest(taskUrl, token, {
          method: 'POST',
          body: JSON.stringify({
            task_name: task_description,
            task_device: actualTaskDeviceName,
            task_progress: 0,
            task_status: 'pending'
          })
        });
        const taskData = await taskResponse.json() as any;
        return { content: [{ type: "text", text: `Task added:\n${JSON.stringify(taskData.taskInfo || taskData, null, 2)}` }] };
        
      case 'banbury-add-model':
        const { device_name: modelDeviceName, model_name } = parameters;
        const modelUrl = `${baseUrl}/devices/add_downloaded_model/`;
        const modelResponse = await makeAuthenticatedRequest(modelUrl, token, {
          method: 'POST',
          body: JSON.stringify({
            device_name: modelDeviceName,
            model_name
          })
        });
        const modelData = await modelResponse.json() as any;
        return { content: [{ type: "text", text: `Model added:\n${JSON.stringify(modelData, null, 2)}` }] };
        
      default:
        throw new Error(`Unknown Banbury tool: ${tool}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: `❌ Error executing ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

startServer();
