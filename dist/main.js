import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import * as http from "http";
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
const TRANSPORT_MODE = process.env.MCP_TRANSPORT || 'stdio';
const HTTP_PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : 3001;
async function makeAuthenticatedRequest(url, token, options = {}, apiKey) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(apiKey && { 'X-API-Key': apiKey }),
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
async function makeRequest(url, options = {}, apiKey) {
    const headers = {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey }),
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
const server = new McpServer({
    name: "Banbury Cloud MCP Server",
    version: "2.0.0"
});
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
}));
server.tool("get-joke", {}, async () => {
    try {
        const response = await fetch("https://official-joke-api.appspot.com/random_joke");
        const joke = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `${joke.setup}\n${joke.punchline}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: "Sorry, couldn't fetch a joke right now!"
                }]
        };
    }
});
server.tool("banbury-login", {
    username: z.string(),
    password: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ username, password, environment }) => {
    try {
        const env = environment;
        const baseUrl = BANBURY_CONFIG[env].url;
        const url = `${baseUrl}/authentication/getuserinfo4/${username}/${password}`;
        console.log(`🔍 Calling banbury-login:`, {
            url,
            username,
            password,
            environment
        });
        const response = await makeRequest(url);
        const data = await response.json();
        if (data.result === 'success') {
            return {
                content: [{
                        type: "text",
                        text: `✅ Successfully logged in as ${username}\nToken: ${data.token}\nUser Info: ${JSON.stringify(data.user_info, null, 2)}\n\n⚠️  Save this token for future requests!`
                    }]
            };
        }
        else {
            return {
                content: [{
                        type: "text",
                        text: `❌ Login failed: ${data.message || 'Invalid credentials'}`
                    }]
            };
        }
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-get-device-info", {
    token: z.string(),
    device_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, device_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/get_single_device_info_with_device_name/${device_name}`;
        const response = await makeAuthenticatedRequest(url, token);
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Device Info for ${device_name}:\n${JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error fetching device info: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-update-device", {
    token: z.string(),
    username: z.string(),
    device_name: z.string().optional(),
    sending_device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, username, device_name, sending_device_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/update_device_info/`;
        const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
        const actualSendingDeviceName = sending_device_name || actualDeviceName;
        const deviceInfo = {
            user: username,
            device_number: 0,
            device_name: actualDeviceName,
            files: [],
            date_added: new Date().toISOString(),
        };
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify({
                device_info: deviceInfo,
                sending_device_name: actualSendingDeviceName
            })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Device update result: ${data.result || JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error updating device: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-declare-online", {
    token: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, device_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/declare_device_online/`;
        const actualDeviceName = device_name || `cloud-mcp-${Date.now()}`;
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify({ device_name: actualDeviceName })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Declare online result: ${data.result || JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error declaring device online: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-get-files", {
    token: z.string(),
    file_path: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, file_path, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/files/get_files_from_filepath/`;
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify({ global_file_path: file_path })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Files from ${file_path}:\n${JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error fetching files: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-get-scanned-folders", {
    token: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, device_name, environment }) => {
    try {
        const env = environment;
        const baseUrl = BANBURY_CONFIG[env].url;
        let targetDeviceName = device_name;
        if (!targetDeviceName) {
            console.log('🔍 No device name provided, getting user devices...');
            try {
                const devicesUrl = `${baseUrl}/devices/getdeviceinfo/`;
                const devicesResponse = await makeAuthenticatedRequest(devicesUrl, token);
                const devicesData = await devicesResponse.json();
                if (devicesData.devices && devicesData.devices.length > 0) {
                    targetDeviceName = devicesData.devices[0].device_name;
                    console.log(`✅ Using first available device: ${targetDeviceName}`);
                }
                else {
                    return {
                        content: [{
                                type: "text",
                                text: `❌ No devices found for your account.\n\n` +
                                    `You need to register a device in Banbury before you can access scanned folders.\n\n` +
                                    `💡 Please register your device in the Banbury application first.`
                            }]
                    };
                }
            }
            catch (deviceError) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ Could not get user devices: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}\n\n` +
                                `This is required to find scanned folders. Please ensure:\n` +
                                `• You are properly authenticated\n` +
                                `• Your device is registered in Banbury\n` +
                                `• The Banbury backend is accessible`
                        }]
                };
            }
        }
        const url = `${baseUrl}/files/get_scanned_folders/`;
        const requestBody = { device_name: targetDeviceName };
        console.log(`🔍 Calling banbury-get-scanned-folders:`, {
            url,
            device_name: targetDeviceName,
            requestBody,
            hasToken: !!token
        });
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        const scanData = await response.json();
        const scannedFolders = scanData.scanned_folders || [];
        if (scannedFolders.length === 0) {
            console.log('❌ No scanned folders found');
            return {
                content: [{
                        type: "text",
                        text: `❌ No scanned folders found for device '${targetDeviceName}'. Please scan some folders first.\n\nFull response: ${JSON.stringify(scanData, null, 2)}`
                    }]
            };
        }
        console.log(`📂 Found ${scannedFolders.length} scanned folders`);
        return {
            content: [{
                    type: "text",
                    text: `Scanned folders for device '${targetDeviceName}':\n${JSON.stringify(scanData, null, 2)}`
                }]
        };
    }
    catch (error) {
        console.log(`❌ Error in banbury-get-scanned-folders: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
            content: [{
                    type: "text",
                    text: `❌ Error fetching scanned folders: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                        `This is likely because:\n` +
                        `• The device '${device_name || 'auto-detected'}' was not found\n` +
                        `• Your device is not registered in Banbury\n` +
                        `• There are no scanned folders for this device\n\n` +
                        `💡 Try:\n` +
                        `1. Registering your device in Banbury first\n` +
                        `2. Scanning some folders in the Banbury application\n` +
                        `3. Providing a specific device_name parameter if you know it`
                }]
        };
    }
});
server.tool("banbury-get-sessions", {
    token: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/sessions/get_session/`;
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify({})
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Sessions:\n${JSON.stringify(data.sessions || data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error fetching sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-add-task", {
    token: z.string(),
    task_description: z.string(),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, task_description, device_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/tasks/add_task/`;
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
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Task added:\n${JSON.stringify(data.taskInfo || data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error adding task: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.tool("banbury-add-model", {
    token: z.string(),
    device_id: z.string(),
    model_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, device_id, model_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/add_downloaded_model/`;
        const response = await makeAuthenticatedRequest(url, token, {
            method: 'POST',
            body: JSON.stringify({
                device_id,
                model_name
            })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Model added:\n${JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error adding model: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.resource("greeting", new ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => ({
    contents: [{
            uri: uri.href,
            text: `Hello, ${name}!`
        }]
}));
server.prompt("review-code", { code: z.string() }, ({ code }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please review this code:\n\n${code}`
            }
        }]
}));
server.prompt("summarize-text", { text: z.string() }, ({ text }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Summarize the following:\n\n${text}`
            }
        }]
}));
server.prompt("joke-summary", {}, async () => {
    const response = await fetch("https://official-joke-api.appspot.com/random_joke");
    const joke = await response.json();
    return {
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `Here's a joke for you:\n\n${joke.setup}\n${joke.punchline}\n\nCan you summarize this joke in one sentence?`
                }
            }]
    };
});
server.tool("banbury-get-random-files", {
    token: z.string(),
    count: z.number().optional().default(10),
    device_name: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ token, count, device_name, environment }) => {
    try {
        const env = environment;
        const baseUrl = BANBURY_CONFIG[env].url;
        console.log(`🎲 Starting banbury-get-random-files - Count: ${count}, Device: ${device_name || 'auto-detect'}`);
        let targetDeviceName = device_name;
        if (!targetDeviceName) {
            console.log('🔍 Getting user devices...');
            try {
                const devicesUrl = `${baseUrl}/devices/getdeviceinfo/`;
                const devicesResponse = await makeAuthenticatedRequest(devicesUrl, token);
                const devicesData = await devicesResponse.json();
                if (devicesData.devices && devicesData.devices.length > 0) {
                    targetDeviceName = devicesData.devices[0].device_name;
                    console.log(`✅ Using device: ${targetDeviceName}`);
                }
                else {
                    return {
                        content: [{
                                type: "text",
                                text: `❌ No devices found for your account. Please register a device first.`
                            }]
                    };
                }
            }
            catch (deviceError) {
                console.error('Error getting devices:', deviceError);
                return {
                    content: [{
                            type: "text",
                            text: `❌ Could not get user devices: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}`
                        }]
                };
            }
        }
        console.log(`📁 Getting scanned folders for device: ${targetDeviceName}`);
        const scanUrl = `${baseUrl}/files/get_scanned_folders/`;
        const scanResponse = await makeAuthenticatedRequest(scanUrl, token, {
            method: 'POST',
            body: JSON.stringify({ device_name: targetDeviceName })
        });
        const scanData = await scanResponse.json();
        const scannedFolders = scanData.scanned_folders || [];
        if (scannedFolders.length === 0) {
            console.log('❌ No scanned folders found');
            return {
                content: [{
                        type: "text",
                        text: `❌ No scanned folders found for device '${targetDeviceName}'. Please scan some folders first.\n\nFull response: ${JSON.stringify(scanData, null, 2)}`
                    }]
            };
        }
        console.log(`📂 Found ${scannedFolders.length} scanned folders`);
        const maxFolders = Math.min(3, scannedFolders.length);
        const randomFolders = scannedFolders
            .sort(() => 0.5 - Math.random())
            .slice(0, maxFolders);
        console.log(`🎯 Processing ${randomFolders.length} folders:`, randomFolders);
        return {
            content: [{
                    type: "text",
                    text: `🎲 Random ${randomFolders.length} folders from device '${targetDeviceName}' (from ${randomFolders.length} folders):\n\n${JSON.stringify(randomFolders, null, 2)}`
                }]
        };
    }
    catch (error) {
        console.error('❌ Error in banbury-get-random-files:', error);
        return {
            content: [{
                    type: "text",
                    text: `❌ Error getting random files: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
async function startServer() {
    if (TRANSPORT_MODE === 'http') {
        console.log(`🌐 Starting HTTP MCP Server on port ${HTTP_PORT}`);
        console.log(`📡 Server URL: http://localhost:${HTTP_PORT}`);
        console.log(`🔗 Use this URL in your frontend MCP client configuration`);
        const httpServer = http.createServer(async (req, res) => {
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
                req.on('data', (chunk) => body += chunk);
                req.on('end', async () => {
                    try {
                        const { tool, parameters } = JSON.parse(body);
                        const authHeader = req.headers['authorization'];
                        const authToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') :
                            req.headers['x-auth-token'] ||
                                parameters.token;
                        const apiKey = req.headers['x-api-key'] || parameters.apiKey;
                        const username = req.headers['x-username'] || parameters.username;
                        const authenticatedParams = {
                            ...parameters,
                            ...(authToken && { token: authToken }),
                            ...(apiKey && { apiKey: apiKey }),
                            ...(username && { username: username })
                        };
                        let result;
                        switch (tool) {
                            case 'add':
                                const { a, b } = authenticatedParams;
                                result = { content: [{ type: "text", text: String(a + b) }] };
                                break;
                            case 'get-joke':
                                try {
                                    const response = await fetch("https://official-joke-api.appspot.com/random_joke");
                                    const joke = await response.json();
                                    result = { content: [{ type: "text", text: `${joke.setup}\n${joke.punchline}` }] };
                                }
                                catch (error) {
                                    result = { content: [{ type: "text", text: "Sorry, couldn't fetch a joke right now!" }] };
                                }
                                break;
                            case 'banbury-login':
                                const { username, password, environment = 'dev' } = authenticatedParams;
                                try {
                                    const env = environment;
                                    const baseUrl = BANBURY_CONFIG[env].url;
                                    const url = `${baseUrl}/authentication/getuserinfo4/${username}/${password}`;
                                    const response = await makeRequest(url, {}, apiKey);
                                    const data = await response.json();
                                    if (data.result === 'success') {
                                        result = { content: [{ type: "text", text: `✅ Successfully logged in as ${username}\nToken: ${data.token}\nUser Info: ${JSON.stringify(data.user_info, null, 2)}\n\n⚠️  Save this token for future requests!` }] };
                                    }
                                    else {
                                        result = { content: [{ type: "text", text: `❌ Login failed: ${data.message || 'Invalid credentials'}` }] };
                                    }
                                }
                                catch (error) {
                                    result = { content: [{ type: "text", text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
                                }
                                break;
                            default:
                                if (tool.startsWith('banbury-')) {
                                    result = await handleBanburyTool(tool, authenticatedParams);
                                }
                                else {
                                    res.writeHead(404, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: `Tool ${tool} not found` }));
                                    return;
                                }
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    }
                    catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }));
                    }
                });
            }
            else if (req.method === 'GET' && req.url === '/health') {
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
                        'banbury-add-model', 'banbury-get-random-files'
                    ],
                    authentication: {
                        supportedHeaders: ['Authorization', 'X-API-Key', 'X-Auth-Token', 'X-Username'],
                        methods: [
                            'Bearer token in Authorization header (Primary)',
                            'Token in X-Auth-Token header (Fallback)',
                            'API Key in X-API-Key header',
                            'Username in X-Username header',
                            'Token/API Key in request parameters (Legacy)'
                        ],
                        priorityOrder: 'Authorization Bearer > X-Auth-Token > Request Parameters'
                    }
                }));
            }
            else if (req.method === 'GET' && req.url === '/tools') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    tools: [
                        {
                            name: "add",
                            description: "Add two numbers together",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    a: { type: "number", description: "First number" },
                                    b: { type: "number", description: "Second number" }
                                },
                                required: ["a", "b"]
                            }
                        },
                        {
                            name: "get-joke",
                            description: "Get a random joke",
                            inputSchema: {
                                type: "object",
                                properties: {},
                                required: []
                            }
                        },
                        {
                            name: "banbury-login",
                            description: "Login to Banbury and get authentication token",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    username: { type: "string", description: "Username" },
                                    password: { type: "string", description: "Password" },
                                    environment: { type: "string", enum: ["dev", "prod"], description: "Environment" }
                                },
                                required: ["username", "password"]
                            }
                        },
                        {
                            name: "banbury-get-device-info",
                            description: "Get information about a specific device",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    token: { type: "string", description: "Authentication token" },
                                    device_name: { type: "string", description: "Name of the device" },
                                    environment: { type: "string", enum: ["dev", "prod"], description: "Environment" }
                                },
                                required: ["token", "device_name"]
                            }
                        },
                        {
                            name: "banbury-get-scanned-folders",
                            description: "Get scanned folders for a device",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    token: { type: "string", description: "Authentication token" },
                                    device_name: { type: "string", description: "Device name (optional, will auto-detect if not provided)" },
                                    environment: { type: "string", enum: ["dev", "prod"], description: "Environment" }
                                },
                                required: ["token"]
                            }
                        },
                        {
                            name: "banbury-add-task",
                            description: "Add a new task to Banbury",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    token: { type: "string", description: "Authentication token" },
                                    task_description: { type: "string", description: "Description of the task" },
                                    device_name: { type: "string", description: "Device name (optional)" },
                                    environment: { type: "string", enum: ["dev", "prod"], description: "Environment" }
                                },
                                required: ["token", "task_description"]
                            }
                        },
                        {
                            name: "banbury-get-sessions",
                            description: "Get current sessions",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    token: { type: "string", description: "Authentication token" },
                                    environment: { type: "string", enum: ["dev", "prod"], description: "Environment" }
                                },
                                required: ["token"]
                            }
                        }
                    ]
                }));
            }
            else {
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
    }
    else {
        console.log(`📡 Starting Stdio MCP Server`);
        console.log(`🔗 This server communicates via stdin/stdout`);
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log(`✅ Stdio MCP Server connected and ready`);
    }
}
async function handleBanburyTool(tool, parameters) {
    const { token, apiKey, environment = 'dev' } = parameters;
    const env = environment;
    const baseUrl = BANBURY_CONFIG[env].url;
    try {
        switch (tool) {
            case 'banbury-get-device-info':
                const { device_name } = parameters;
                const deviceUrl = `${baseUrl}/devices/get_single_device_info_with_device_name/${device_name}`;
                const deviceResponse = await makeAuthenticatedRequest(deviceUrl, token, {}, apiKey);
                const deviceData = await deviceResponse.json();
                return { content: [{ type: "text", text: `Device Info for ${device_name}:\n${JSON.stringify(deviceData, null, 2)}` }] };
            case 'banbury-update-device':
                const { username, device_name: updateDeviceName, sending_device_name } = parameters;
                const updateUrl = `${baseUrl}/devices/update_device_info/`;
                const actualDeviceName = updateDeviceName || `cloud-mcp-${Date.now()}`;
                const actualSendingDeviceName = sending_device_name || actualDeviceName;
                const deviceInfo = {
                    user: username,
                    device_number: 0,
                    device_name: actualDeviceName,
                    files: [],
                    date_added: new Date().toISOString(),
                };
                const updateResponse = await makeAuthenticatedRequest(updateUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({
                        device_info: deviceInfo,
                        sending_device_name: actualSendingDeviceName
                    })
                }, apiKey);
                const updateData = await updateResponse.json();
                return { content: [{ type: "text", text: `Device update result: ${updateData.result || JSON.stringify(updateData, null, 2)}` }] };
            case 'banbury-declare-online':
                const { device_name: onlineDeviceName } = parameters;
                const onlineUrl = `${baseUrl}/devices/declare_device_online/`;
                const actualOnlineDeviceName = onlineDeviceName || `cloud-mcp-${Date.now()}`;
                const onlineResponse = await makeAuthenticatedRequest(onlineUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({ device_name: actualOnlineDeviceName })
                }, apiKey);
                const onlineData = await onlineResponse.json();
                return { content: [{ type: "text", text: `Declare online result: ${onlineData.result || JSON.stringify(onlineData, null, 2)}` }] };
            case 'banbury-get-files':
                const { file_path } = parameters;
                const filesUrl = `${baseUrl}/files/get_files_from_filepath/`;
                const filesResponse = await makeAuthenticatedRequest(filesUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({ global_file_path: file_path })
                }, apiKey);
                const filesData = await filesResponse.json();
                return { content: [{ type: "text", text: `Files from ${file_path}:\n${JSON.stringify(filesData, null, 2)}` }] };
            case 'banbury-get-scanned-folders':
                const { device_name: scanDeviceName } = parameters;
                let targetScanDeviceName = scanDeviceName;
                if (!targetScanDeviceName) {
                    console.log('🔍 No device name provided, getting user devices...');
                    try {
                        const devicesUrl = `${baseUrl}/devices/getdeviceinfo/`;
                        const devicesResponse = await makeAuthenticatedRequest(devicesUrl, token, {}, apiKey);
                        const devicesData = await devicesResponse.json();
                        if (devicesData.devices && devicesData.devices.length > 0) {
                            targetScanDeviceName = devicesData.devices[0].device_name;
                            console.log(`✅ Using first available device: ${targetScanDeviceName}`);
                        }
                        else {
                            return {
                                content: [{
                                        type: "text",
                                        text: `❌ No devices found for your account.\n\n` +
                                            `You need to register a device in Banbury before you can access scanned folders.\n\n` +
                                            `💡 Please register your device in the Banbury application first.`
                                    }]
                            };
                        }
                    }
                    catch (deviceError) {
                        return {
                            content: [{
                                    type: "text",
                                    text: `❌ Could not get user devices: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}\n\n` +
                                        `This is required to find scanned folders. Please ensure:\n` +
                                        `• You are properly authenticated\n` +
                                        `• Your device is registered in Banbury\n` +
                                        `• The Banbury backend is accessible`
                                }]
                        };
                    }
                }
                const scanUrl = `${baseUrl}/files/get_scanned_folders/`;
                const scanRequestBody = { device_name: targetScanDeviceName };
                console.log(`🔍 HTTP: Calling banbury-get-scanned-folders:`, {
                    url: scanUrl,
                    device_name: targetScanDeviceName,
                    requestBody: scanRequestBody,
                    hasToken: !!token
                });
                const scanResponse = await makeAuthenticatedRequest(scanUrl, token, {
                    method: 'POST',
                    body: JSON.stringify(scanRequestBody)
                }, apiKey);
                const scanData = await scanResponse.json();
                return { content: [{ type: "text", text: `Scanned folders for device '${targetScanDeviceName}':\n${JSON.stringify(scanData, null, 2)}` }] };
            case 'banbury-get-sessions':
                const sessionsUrl = `${baseUrl}/sessions/get_session/`;
                const sessionsResponse = await makeAuthenticatedRequest(sessionsUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({})
                }, apiKey);
                const sessionsData = await sessionsResponse.json();
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
                }, apiKey);
                const taskData = await taskResponse.json();
                return { content: [{ type: "text", text: `Task added:\n${JSON.stringify(taskData.taskInfo || taskData, null, 2)}` }] };
            case 'banbury-add-model':
                const { device_id, model_name } = parameters;
                const modelUrl = `${baseUrl}/devices/add_downloaded_model/`;
                const modelResponse = await makeAuthenticatedRequest(modelUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({
                        device_id,
                        model_name
                    })
                }, apiKey);
                const modelData = await modelResponse.json();
                return { content: [{ type: "text", text: `Model added:\n${JSON.stringify(modelData, null, 2)}` }] };
            case 'banbury-get-random-files':
                const { count = 10, device_name: randomDeviceName } = parameters;
                console.log(`🎲 HTTP: Starting banbury-get-random-files - Count: ${count}, Device: ${randomDeviceName || 'auto-detect'}`);
                let randomTargetDeviceName = randomDeviceName;
                if (!randomTargetDeviceName) {
                    console.log('🔍 HTTP: Getting user devices...');
                    try {
                        const devicesUrl = `${baseUrl}/devices/getdeviceinfo/`;
                        const devicesResponse = await makeAuthenticatedRequest(devicesUrl, token, {}, apiKey);
                        const devicesData = await devicesResponse.json();
                        if (devicesData.devices && devicesData.devices.length > 0) {
                            randomTargetDeviceName = devicesData.devices[0].device_name;
                            console.log(`✅ HTTP: Using device: ${randomTargetDeviceName}`);
                        }
                        else {
                            return {
                                content: [{
                                        type: "text",
                                        text: `❌ No devices found for your account. Please register a device first.`
                                    }]
                            };
                        }
                    }
                    catch (deviceError) {
                        console.error('HTTP: Error getting devices:', deviceError);
                        return {
                            content: [{
                                    type: "text",
                                    text: `❌ Could not get user devices: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}`
                                }]
                        };
                    }
                }
                console.log(`📁 HTTP: Getting scanned folders for device: ${randomTargetDeviceName}`);
                const randomScanUrl = `${baseUrl}/files/get_scanned_folders/`;
                const randomScanResponse = await makeAuthenticatedRequest(randomScanUrl, token, {
                    method: 'POST',
                    body: JSON.stringify({ device_name: randomTargetDeviceName })
                }, apiKey);
                const randomScanData = await randomScanResponse.json();
                const randomScannedFolders = randomScanData.scanned_folders || [];
                if (randomScannedFolders.length === 0) {
                    console.log('❌ HTTP: No scanned folders found');
                    return {
                        content: [{
                                type: "text",
                                text: `❌ No scanned folders found for device '${randomTargetDeviceName}'. Please scan some folders first.\n\nFull response: ${JSON.stringify(randomScanData, null, 2)}`
                            }]
                    };
                }
                console.log(`📂 HTTP: Found ${randomScannedFolders.length} scanned folders`);
                const httpMaxFolders = Math.min(3, randomScannedFolders.length);
                const randomFolders = randomScannedFolders
                    .sort(() => 0.5 - Math.random())
                    .slice(0, httpMaxFolders);
                console.log(`🎯 HTTP: Processing ${randomFolders.length} folders:`, randomFolders);
                const allFiles = [];
                let httpRequestCount = 0;
                const httpMaxRequests = 5;
                for (const folder of randomFolders) {
                    if (httpRequestCount >= httpMaxRequests) {
                        console.log(`⚠️ HTTP: Reached maximum request limit (${httpMaxRequests}), stopping folder processing`);
                        break;
                    }
                    try {
                        console.log(`📄 HTTP: Getting files from folder: ${folder}`);
                        httpRequestCount++;
                        const filesUrl = `${baseUrl}/files/get_files_from_filepath/`;
                        const filesResponse = await makeAuthenticatedRequest(filesUrl, token, {
                            method: 'POST',
                            body: JSON.stringify({ global_file_path: folder })
                        }, apiKey);
                        const filesData = await filesResponse.json();
                        if (filesData.files && Array.isArray(filesData.files)) {
                            const filesWithSource = filesData.files.map((file) => ({
                                ...file,
                                source_folder: folder
                            }));
                            allFiles.push(...filesWithSource);
                            console.log(`✅ HTTP: Added ${filesWithSource.length} files from ${folder}`);
                        }
                        else {
                            console.log(`⚠️ HTTP: No files found in ${folder}`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ HTTP: Error getting files from ${folder}:`, error);
                    }
                }
                const httpSafeCount = Math.min(count, 50);
                const randomFiles = allFiles
                    .sort(() => 0.5 - Math.random())
                    .slice(0, httpSafeCount);
                console.log(`🎲 HTTP: Selected ${randomFiles.length} random files from ${allFiles.length} total files`);
                console.log(`📊 HTTP: Total API requests made: ${httpRequestCount + 2}`);
                return { content: [{ type: "text", text: `🎲 Random ${randomFiles.length} files from device '${randomTargetDeviceName}' (from ${randomFolders.length} folders):\n\n${JSON.stringify(randomFiles, null, 2)}` }] };
            default:
                throw new Error(`Unknown Banbury tool: ${tool}`);
        }
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ Error executing ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
    }
}
startServer();
