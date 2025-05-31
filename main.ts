import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
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

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
