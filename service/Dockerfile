FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production

ARG APP_REVISION=unknown
ENV APP_REVISION=${APP_REVISION}

CMD ["pnpm", "start"]
EXPOSE 29691