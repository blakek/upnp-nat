import { isProtocol, type CreatePortMappingOptions } from "./upnp";

export interface Config extends CreatePortMappingOptions {
  /** URL to the gateway's description XML. */
  gatewayDescriptionUrl: string;
}

export function getConfig(): Config {
  const description = process.env.UPNP_DESCRIPTION;
  const externalPort = parseIntEnv("UPNP_EXTERNAL_PORT", 443);
  const gatewayDescriptionUrl = ensureEnv("UPNP_GATEWAY_DESCRIPTION_URL");
  const internalIp = ensureEnv("UPNP_INTERNAL_IP");
  const internalPort = parseIntEnv("UPNP_INTERNAL_PORT", 443);
  const leaseTimeInMs = parseIntEnv("UPNP_LEASE_TIME_IN_MS", 0);
  const protocolRaw = process.env.UPNP_PROTOCOL;
  const protocol = protocolRaw && protocolRaw.length > 0 ? protocolRaw : "TCP";

  if (!isProtocol(protocol)) {
    throw new Error(
      `Invalid protocol: “${protocol}”. Must be either “TCP” or “UDP”.`,
    );
  }

  return {
    description,
    externalPort,
    gatewayDescriptionUrl,
    internalIp,
    internalPort,
    leaseTimeInMs,
    protocol,
  };
}

/** Ensures that an environment variable is set and returns its value. */
function ensureEnv(name: string): string {
  const value = process.env[name];

  // Value is missing or empty string
  if (!value) {
    throw new Error(`Missing environment variable: “${name}”`);
  }

  return value;
}

function requireValueOrFallback(
  name: string,
  fallback: string | undefined,
): string {
  if (name in process.env && process.env[name]) {
    return process.env[name];
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error("Value is required but was not provided");
}

/** Parses an environment variable as an integer. */
function parseIntEnv(name: string, defaultValue?: number): number {
  const value = requireValueOrFallback(name, defaultValue?.toString());

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable “${name}” must be an integer`);
  }

  return parsed;
}
