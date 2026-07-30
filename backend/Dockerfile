FROM node:20-alpine

# Set non-root user for security compliance
USER node

WORKDIR /usr/src/app

# Copy dependency configs first to leverage Docker layer caching
COPY --chown=node:node package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy remaining source code
COPY --chown=node:node . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
