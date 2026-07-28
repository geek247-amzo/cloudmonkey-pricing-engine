FROM oven/bun:1-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV GROWTH_AGENT_POLL_SECONDS=60
CMD ["bun", "run", "start"]
