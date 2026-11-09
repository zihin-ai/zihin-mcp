FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY bin/ bin/
COPY src/ src/
COPY plugin/ plugin/
USER node
CMD ["node", "bin/zihin-mcp.js"]
