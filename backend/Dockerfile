FROM node:20-alpine

WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy remaining source code
COPY . .

# Change ownership of the app directory to non-root node user
RUN chown -R node:node /usr/src/app

# Set non-root user
USER node

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
