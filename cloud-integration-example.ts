/**
 * Cloud Integration Example
 * 
 * This file demonstrates how the cloud MCP server would integrate with 
 * the Banbury frontend's credential management system.
 */

import { loadGlobalAxiosCredentials } from './banbury-frontend/packages/core/src/middleware/axiosGlobalHeader';

// Example of how the cloud MCP server would work with frontend credentials
export class CloudMcpServerClient {
  private token?: string;
  private username?: string;
  private apiKey?: string;
  private mcpServerUrl: string;

  constructor(mcpServerUrl: string) {
    this.mcpServerUrl = mcpServerUrl;
    this.loadCredentials();
  }

  /**
   * Load credentials from the frontend's credential system
   */
  private loadCredentials() {
    const credentials = loadGlobalAxiosCredentials();
    this.token = credentials.token;
    this.username = credentials.username;
    this.apiKey = credentials.apiKey;
  }

  /**
   * Make an authenticated request to the cloud MCP server
   */
  private async makeCloudMcpRequest(tool: string, params: any) {
    if (!this.token) {
      throw new Error('No authentication token available. Please log in first.');
    }

    // Add the token to all Banbury tool requests
    const authenticatedParams = {
      ...params,
      token: this.token
    };

    const response = await fetch(`${this.mcpServerUrl}/tool/${tool}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`, // For MCP server authentication
      },
      body: JSON.stringify(authenticatedParams)
    });

    if (!response.ok) {
      throw new Error(`MCP Server Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get 10 random files using the cloud MCP server
   */
  async get10RandomFiles() {
    try {
      // First get scanned folders
      const foldersResult = await this.makeCloudMcpRequest('banbury-get-scanned-folders', {
        environment: 'dev'
      });

      const scannedFolders = foldersResult.content[0].text;
      console.log('Scanned folders:', scannedFolders);

      // Parse the folders and get files from different paths
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
              // Add a random sample of files
              const sampleSize = Math.min(2, filesData.files.length);
              const randomSample = filesData.files
                .sort(() => 0.5 - Math.random())
                .slice(0, sampleSize);
              
              randomFiles.push(...randomSample);
            }
          } catch (error) {
            // Continue if a specific path doesn't exist
            continue;
          }

          // Stop once we have 10 files
          if (randomFiles.length >= 10) {
            break;
          }
        }
        
        if (randomFiles.length >= 10) {
          break;
        }
      }

      return randomFiles.slice(0, 10);

    } catch (error) {
      console.error('Error getting random files:', error);
      throw error;
    }
  }

  /**
   * Example usage with device management
   */
  async manageDevice() {
    try {
      // Update device info
      await this.makeCloudMcpRequest('banbury-update-device', {
        username: this.username,
        device_name: 'cloud-frontend-client',
        environment: 'dev'
      });

      // Declare device online
      await this.makeCloudMcpRequest('banbury-declare-online', {
        device_name: 'cloud-frontend-client',
        environment: 'dev'
      });

      console.log('Device management completed');
    } catch (error) {
      console.error('Error managing device:', error);
      throw error;
    }
  }

  /**
   * Add a task through the cloud MCP server
   */
  async addTask(taskDescription: string) {
    try {
      const result = await this.makeCloudMcpRequest('banbury-add-task', {
        task_description: taskDescription,
        device_name: 'cloud-frontend-client',
        environment: 'dev'
      });

      return result;
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  }
}

/**
 * Example usage in a frontend application
 */
export async function exampleUsage() {
  // Initialize the cloud MCP client
  const mcpClient = new CloudMcpServerClient('https://your-cloud-mcp-server.com');

  try {
    // Get 10 random files
    const randomFiles = await mcpClient.get10RandomFiles();
    console.log('Random files:', randomFiles);

    // Manage device
    await mcpClient.manageDevice();

    // Add a task
    const taskResult = await mcpClient.addTask('Process random files');
    console.log('Task added:', taskResult);

  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

/**
 * Integration with React components
 */
export function useBanburyCloudMcp() {
  const [mcpClient, setMcpClient] = useState<CloudMcpServerClient | null>(null);

  useEffect(() => {
    // Initialize MCP client when credentials are available
    const credentials = loadGlobalAxiosCredentials();
    if (credentials.token) {
      setMcpClient(new CloudMcpServerClient(process.env.REACT_APP_MCP_SERVER_URL || ''));
    }
  }, []);

  return {
    mcpClient,
    get10RandomFiles: () => mcpClient?.get10RandomFiles(),
    addTask: (description: string) => mcpClient?.addTask(description),
    manageDevice: () => mcpClient?.manageDevice()
  };
} 