# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS prerelease
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# copy production dependencies and source code into final image
FROM oven/bun:1 AS release
WORKDIR /app
COPY --from=prerelease /app/dist/upnp-nat /app/upnp-nat
ENTRYPOINT [ "/app/upnp-nat" ]
