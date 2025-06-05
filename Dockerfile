# Use Node.js LTS Alpine image for smaller size
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . ./

# Build TypeScript (if main.js doesn't exist)
RUN if [ ! -f "main.js" ]; then npm run build; fi

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Set environment variables
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=3001
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the server
CMD ["node", "main.js"] 