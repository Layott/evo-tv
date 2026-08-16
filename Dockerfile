# EVO TV backend. Single stage on purpose: `next start` needs node_modules at
# runtime anyway, so a multi-stage split would save little and cost clarity.
#
# Full node:22 (not -slim) because better-sqlite3 compiles native code and slim
# lacks the toolchain.
FROM node:22

WORKDIR /app

# Corepack reads "packageManager" from package.json and installs that exact
# pnpm. Without the pin it grabs latest (pnpm 11), which ignores the
# pnpm.onlyBuiltDependencies field and then hard-fails on ignored build
# scripts. Keep the pin in sync with the version you run locally.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Placeholder so module-level env guards (lib/db/index.ts throws without a
# connection string) do not abort the build. Never used to connect: the real
# value arrives at runtime from the env file.
ENV DATABASE_URL="postgres://build:build@127.0.0.1:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Dependencies first so edits to app code reuse the install layer.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Anything named NEXT_PUBLIC_* is inlined into the client bundle at build time,
# so it has to be present here rather than only in the runtime env file. These
# are store and download links: public by definition, empty until there is
# something to point at, and the page says "not out yet" while they are.
ARG NEXT_PUBLIC_ANDROID_APK_URL=""
ARG NEXT_PUBLIC_PLAY_STORE_URL=""
ARG NEXT_PUBLIC_APP_STORE_URL=""
ENV NEXT_PUBLIC_ANDROID_APK_URL=$NEXT_PUBLIC_ANDROID_APK_URL
ENV NEXT_PUBLIC_PLAY_STORE_URL=$NEXT_PUBLIC_PLAY_STORE_URL
ENV NEXT_PUBLIC_APP_STORE_URL=$NEXT_PUBLIC_APP_STORE_URL

COPY . .
RUN pnpm build

EXPOSE 3060
CMD ["pnpm", "start"]
