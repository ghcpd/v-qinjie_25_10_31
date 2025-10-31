# Secure baseline Dockerfile for the vulnerable demo service
FROM node:18-alpine

WORKDIR /usr/src/app

# Only copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy application source
COPY . .

# Expose the HTTP port used by Express
EXPOSE 3000

# Use a non-root user for runtime isolation
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "app.js"]
