FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production

ARG COMMIT_HASH=unknown
ENV COMMIT_HASH=${COMMIT_HASH}

CMD ["pnpm", "start"]
EXPOSE 29691