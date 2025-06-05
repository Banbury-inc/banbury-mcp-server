import { loadGlobalAxiosCredentials } from './banbury-frontend/packages/core/src/middleware/axiosGlobalHeader';
export class CloudMcpServerClient {
    token;
    username;
    apiKey;
    mcpServerUrl;
    constructor(mcpServerUrl) {
        this.mcpServerUrl = mcpServerUrl;
        this.loadCredentials();
    }
    loadCredentials() {
        const credentials = loadGlobalAxiosCredentials();
        this.token = credentials.token;
        this.username = credentials.username;
        this.apiKey = credentials.apiKey;
    }
    async makeCloudMcpRequest(tool, params) {
        if (!this.token) {
            throw new Error('No authentication token available. Please log in first.');
        }
        const authenticatedParams = {
            ...params,
            token: this.token
        };
        const response = await fetch(`${this.mcpServerUrl}/tool/${tool}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(authenticatedParams)
        });
        if (!response.ok) {
            throw new Error(`MCP Server Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async get10RandomFiles() {
        try {
            const foldersResult = await this.makeCloudMcpRequest('banbury-get-scanned-folders', {
                environment: 'dev'
            });
            const scannedFolders = foldersResult.content[0].text;
            console.log('Scanned folders:', scannedFolders);
            const folders = JSON.parse(scannedFolders.split('\n')[1]).scanned_folders;
            const randomFiles = [];
            const possiblePaths = [
                '/Documents',
                '/Desktop',
                '/Downloads',
                '/Pictures',
                '/Music',
                '/Videos',
                '/Projects',
                '/Code',
                '/tmp',
                '/Library'
            ];
            for (const folder of folders) {
                for (const subPath of possiblePaths) {
                    try {
                        const filesResult = await this.makeCloudMcpRequest('banbury-get-files', {
                            file_path: folder + subPath,
                            environment: 'dev'
                        });
                        const filesData = JSON.parse(filesResult.content[0].text.split('\n')[1]);
                        if (filesData.files && filesData.files.length > 0) {
                            const sampleSize = Math.min(2, filesData.files.length);
                            const randomSample = filesData.files
                                .sort(() => 0.5 - Math.random())
                                .slice(0, sampleSize);
                            randomFiles.push(...randomSample);
                        }
                    }
                    catch (error) {
                        continue;
                    }
                    if (randomFiles.length >= 10) {
                        break;
                    }
                }
                if (randomFiles.length >= 10) {
                    break;
                }
            }
            return randomFiles.slice(0, 10);
        }
        catch (error) {
            console.error('Error getting random files:', error);
            throw error;
        }
    }
    async manageDevice() {
        try {
            await this.makeCloudMcpRequest('banbury-update-device', {
                username: this.username,
                device_name: 'cloud-frontend-client',
                environment: 'dev'
            });
            await this.makeCloudMcpRequest('banbury-declare-online', {
                device_name: 'cloud-frontend-client',
                environment: 'dev'
            });
            console.log('Device management completed');
        }
        catch (error) {
            console.error('Error managing device:', error);
            throw error;
        }
    }
    async addTask(taskDescription) {
        try {
            const result = await this.makeCloudMcpRequest('banbury-add-task', {
                task_description: taskDescription,
                device_name: 'cloud-frontend-client',
                environment: 'dev'
            });
            return result;
        }
        catch (error) {
            console.error('Error adding task:', error);
            throw error;
        }
    }
}
export async function exampleUsage() {
    const mcpClient = new CloudMcpServerClient('https://your-cloud-mcp-server.com');
    try {
        const randomFiles = await mcpClient.get10RandomFiles();
        console.log('Random files:', randomFiles);
        await mcpClient.manageDevice();
        const taskResult = await mcpClient.addTask('Process random files');
        console.log('Task added:', taskResult);
    }
    catch (error) {
        console.error('Error in example usage:', error);
    }
}
export function useBanburyCloudMcp() {
    const [mcpClient, setMcpClient] = useState(null);
    useEffect(() => {
        const credentials = loadGlobalAxiosCredentials();
        if (credentials.token) {
            setMcpClient(new CloudMcpServerClient(process.env.REACT_APP_MCP_SERVER_URL || ''));
        }
    }, []);
    return {
        mcpClient,
        get10RandomFiles: () => mcpClient?.get10RandomFiles(),
        addTask: (description) => mcpClient?.addTask(description),
        manageDevice: () => mcpClient?.manageDevice()
    };
}
