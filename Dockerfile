# ARG that defines which service to build
ARG SERVICE_NAME

# 1. Base stage for installing all dependencies
FROM node:24-alpine AS base
WORKDIR /usr/src/app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy all package.json files to leverage Docker cache
COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/database/package.json ./packages/database/
COPY services/admin/package.json ./services/admin/
COPY services/auth/package.json ./services/auth/
COPY services/booking/package.json ./services/booking/
COPY services/catalog/package.json ./services/catalog/
COPY services/media/package.json ./services/media/
COPY services/notifications/package.json ./services/notifications/
COPY services/partner/package.json ./services/partner/
COPY services/reviews/package.json ./services/reviews/

# Copy the Prisma schema to allow client generation
COPY packages/database/prisma ./packages/database/prisma

# Install all monorepo dependencies (this will also run `prisma generate`)
RUN npm install

# 2. Builder stage to copy source code
FROM base AS builder
WORKDIR /usr/src/app
COPY . .

# 3. Final, pruned production stage
FROM node:24-alpine AS final
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
WORKDIR /usr/src/app

# Copy only the production node_modules from the base stage
COPY --from=base /usr/src/app/node_modules ./node_modules

# Copy the generated Prisma client
COPY --from=builder /usr/src/app/packages/database/prisma ./packages/database/prisma

# Copy the source code for the specific service we're building
COPY --from=builder /usr/src/app/services/${SERVICE_NAME} ./services/${SERVICE_NAME}

# Copy the source for the shared packages
COPY --from=builder /usr/src/app/packages/common ./packages/common
COPY --from=builder /usr/src/app/packages/database ./packages/database

# Set the command to run the specified service
CMD ["sh", "-c", "node ./services/${SERVICE_NAME}/src/index.js"] 