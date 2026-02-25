# upnp-nat

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

Environment variables:

Required:

- UPNP_GATEWAY_DESCRIPTION_URL (gateway description XML URL)
- UPNP_INTERNAL_IP (internal IP to forward to)

Optional:

- UPNP_DESCRIPTION (port mapping description)
- UPNP_EXTERNAL_PORT (default: 443)
- UPNP_INTERNAL_PORT (default: 443)
- UPNP_LEASE_TIME_IN_MS (default: 0)
- UPNP_PROTOCOL (default: TCP)

Docker (after building locally):

```bash
docker run --rm \
	-e UPNP_GATEWAY_DESCRIPTION_URL="http://10.0.0.10:38400/description.xml" \
	-e UPNP_INTERNAL_IP="10.0.2.4" \
	-e UPNP_EXTERNAL_PORT=443 \
	-e UPNP_INTERNAL_PORT=443 \
	-e UPNP_PROTOCOL=TCP \
	upnp-nat
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
