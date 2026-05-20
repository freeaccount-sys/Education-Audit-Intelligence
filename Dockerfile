FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY app.js server.js index.html styles.css ./
COPY audit-data.json audit-index.json audit-pdf-links.json audit-pdf-links.template.json comprehensive-issue-titles.json keyword-audit-source.csv ocr-results.json ./
COPY assets ./assets

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]
