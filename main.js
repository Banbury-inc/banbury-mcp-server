import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
// Banbury configuration
const BANBURY_DIR = path.join(os.homedir(), '.banbury');
const TOKEN_FILE = path.join(BANBURY_DIR, 'token');
const USERNAME_FILE = path.join(BANBURY_DIR, 'username');
// Ensure .banbury directory exists
if (!fs.existsSync(BANBURY_DIR)) {
    fs.mkdirSync(BANBURY_DIR, { recursive: true, mode: 0o700 });
}
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
// Helper functions
function getStoredCredentials() {
    let token = '';
    let username = '';
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        }
        if (fs.existsSync(USERNAME_FILE)) {
            username = fs.readFileSync(USERNAME_FILE, 'utf8').trim();
        }
    }
    catch (error) {
        console.error('Error reading credentials:', error);
    }
    return { token, username };
}
function saveCredentials(token, username) {
    try {
        fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
        fs.writeFileSync(USERNAME_FILE, username, { mode: 0o600 });
    }
    catch (error) {
        console.error('Error saving credentials:', error);
    }
}
async function makeAuthenticatedRequest(url, options = {}) {
    const { token } = getStoredCredentials();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
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
    name: "Banbury MCP Server",
    version: "1.0.0"
});
// Add an addition tool
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
}));
// Add a get-joke tool
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
// Banbury Authentication Tools
server.tool("banbury-login", {
    username: z.string(),
    password: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ username, password, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/authentication/getuserinfo4/${username}/${password}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.result === 'success') {
            saveCredentials(data.token, username);
            return {
                content: [{
                        type: "text",
                        text: `✅ Successfully logged in as ${username}\nToken saved for future requests.\nUser Info: ${JSON.stringify(data.user_info, null, 2)}`
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
// Get current authentication status
server.tool("banbury-auth-status", {}, async () => {
    const { token, username } = getStoredCredentials();
    if (!token || !username) {
        return {
            content: [{
                    type: "text",
                    text: "❌ Not authenticated. Use banbury-login to authenticate."
                }]
        };
    }
    return {
        content: [{
                type: "text",
                text: `✅ Authenticated as: ${username}\nToken exists: ${!!token}`
            }]
    };
});
// Device Management Tools
server.tool("banbury-get-device-info", {
    device_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ device_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/get_single_device_info_with_device_name/${device_name}`;
        const response = await makeAuthenticatedRequest(url);
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Device Info for ${device_name}:\n${JSON.stringify(data.data?.device_info || data, null, 2)}`
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
    username: z.string().optional(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ username, environment }) => {
    try {
        const { username: storedUsername } = getStoredCredentials();
        const user = username || storedUsername;
        if (!user) {
            return {
                content: [{
                        type: "text",
                        text: "❌ Username required. Either provide username parameter or login first."
                    }]
            };
        }
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/update_devices/${user}/`;
        const device_name = os.hostname();
        const deviceInfo = {
            user,
            device_number: 0,
            device_name,
            files: [], // Would normally scan files
            date_added: new Date().toISOString(),
        };
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify(deviceInfo)
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Device update result: ${data.response || JSON.stringify(data, null, 2)}`
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
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/declare_online/`;
        const device_name = os.hostname();
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify({ device_name })
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
// File Management Tools
server.tool("banbury-get-files", {
    file_path: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ file_path, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/files/get_files_from_filepath/`;
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify({ global_file_path: file_path })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Files from ${file_path}:\n${JSON.stringify(data.files || data, null, 2)}`
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
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/files/get_scanned_folders/`;
        const device_name = os.hostname();
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify({ device_name })
        });
        const data = await response.json();
        return {
            content: [{
                    type: "text",
                    text: `Scanned folders:\n${JSON.stringify(data, null, 2)}`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Error fetching scanned folders: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
// Session/Task Management Tools
server.tool("banbury-get-sessions", {
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/sessions/get_session/`;
        const response = await makeAuthenticatedRequest(url, {
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
    task_description: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ task_description, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/tasks/add_task/`;
        const device_name = os.hostname();
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify({
                task_name: task_description,
                task_device: device_name,
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
// Model Management Tool
server.tool("banbury-add-model", {
    device_name: z.string(),
    model_name: z.string(),
    environment: z.enum(['dev', 'prod']).default('dev')
}, async ({ device_name, model_name, environment }) => {
    try {
        const baseUrl = BANBURY_CONFIG[environment].url;
        const url = `${baseUrl}/devices/add_downloaded_model/`;
        const response = await makeAuthenticatedRequest(url, {
            method: 'POST',
            body: JSON.stringify({
                device_name,
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
// Add a dynamic greeting resource
server.resource("greeting", new ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => ({
    contents: [{
            uri: uri.href,
            text: `Hello, ${name}!`
        }]
}));
// Add a review-code prompt
server.prompt("review-code", { code: z.string() }, ({ code }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please review this code:\n\n${code}`
            }
        }]
}));
// Add a summarize-text prompt
server.prompt("summarize-text", { text: z.string() }, ({ text }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Summarize the following:\n\n${text}`
            }
        }]
}));
// Add a joke-summary prompt
server.prompt("joke-summary", {}, async () => {
    // Fetch a random joke from an API
    const response = await fetch("https://official-joke-api.appspot.com/random_joke");
    // Explicitly type the joke object
    const joke = await response.json();
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
});
// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
