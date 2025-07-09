# ARG that defines which service to build. This will be passed from docker-compose.
ARG SERVICE_NAME
ARG PACKAGE_NAME

# ---- Base Image ----
# Use a specific version of Node for reproducibility.
FROM node:24-alpine AS base
WORKDIR /app

# ---- Builder ----
# This stage prunes the monorepo to only include the files needed for the target service.
FROM base AS builder
ARG PACKAGE_NAME
# Install turbo globally to use the prune command. This is a cleaner approach.
RUN npm install -g turbo
# Copy the rest of the source code.
COPY . .
# Run prune. This creates a pruned monorepo in the 'out' directory.
RUN turbo prune ${PACKAGE_NAME} --docker

# ---- Installer ----
# This stage installs dependencies and builds the pruned code.
FROM base AS installer
WORKDIR /app

# Copy the pruned dependency definitions.
COPY --from=builder /app/out/json/ .
# Install ALL dependencies (including devDependencies) to run build scripts (like prisma generate).
RUN npm install

# Copy the pruned source code.
COPY --from=builder /app/out/full/ .
# Run the build command defined in the root package.json.
# This will trigger `prisma generate` for the database package.
RUN npm run build

# Remove development dependencies for a smaller final image.
RUN npm prune --production

# ---- Final Image ----
# This is the final, lean image that will be deployed.
FROM node:24-alpine AS final
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
WORKDIR /app

# Copy production node_modules from the installer stage.
COPY --from=installer /app/node_modules ./node_modules
# Copy the built 'packages' workspace.
COPY --from=installer /app/packages/ ./packages/
# Copy the specific service's code.
COPY --from=installer /app/services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# Set the command to run the specified service.
# Use sh -c to allow environment variable expansion. 'exec' replaces the shell
# process with the node process, making it PID 1.
CMD ["/bin/sh", "-c", "exec node services/${SERVICE_NAME}/src/index.js"] 