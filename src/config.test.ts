import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { getConfig } from "./config";

type EnvKey =
  | "UPNP_DESCRIPTION"
  | "UPNP_EXTERNAL_PORT"
  | "UPNP_GATEWAY_DESCRIPTION_URL"
  | "UPNP_INTERNAL_IP"
  | "UPNP_INTERNAL_PORT"
  | "UPNP_LEASE_TIME_IN_MS"
  | "UPNP_PROTOCOL";

const ENV_KEYS: EnvKey[] = [
  "UPNP_DESCRIPTION",
  "UPNP_EXTERNAL_PORT",
  "UPNP_GATEWAY_DESCRIPTION_URL",
  "UPNP_INTERNAL_IP",
  "UPNP_INTERNAL_PORT",
  "UPNP_LEASE_TIME_IN_MS",
  "UPNP_PROTOCOL",
];

let originalEnv: Record<EnvKey, string | undefined>;

function setRequiredEnv(overrides?: Partial<Record<EnvKey, string>>) {
  process.env.UPNP_GATEWAY_DESCRIPTION_URL =
    overrides?.UPNP_GATEWAY_DESCRIPTION_URL ??
    "http://10.0.0.10:38400/description.xml";
  process.env.UPNP_INTERNAL_IP = overrides?.UPNP_INTERNAL_IP ?? "10.0.2.4";

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      // @ts-expect-error - key is constrained by EnvKey in calling code.
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<EnvKey, string | undefined>;

  // Start each test from a clean slate for these keys.
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getConfig", () => {
  test("throws when required env vars are missing", () => {
    expect(() => getConfig()).toThrow(/UPNP_GATEWAY_DESCRIPTION_URL/);

    process.env.UPNP_GATEWAY_DESCRIPTION_URL =
      "http://10.0.0.10:38400/description.xml";
    expect(() => getConfig()).toThrow(/UPNP_INTERNAL_IP/);
  });

  test("uses defaults for optional values", () => {
    setRequiredEnv();

    const config = getConfig();

    expect(config.gatewayDescriptionUrl).toBe(
      "http://10.0.0.10:38400/description.xml",
    );
    expect(config.internalIp).toBe("10.0.2.4");

    expect(config.description).toBeUndefined();
    expect(config.externalPort).toBe(443);
    expect(config.internalPort).toBe(443);
    expect(config.leaseTimeInMs).toBe(0);
    expect(config.protocol).toBe("TCP");
  });

  test("defaults protocol to TCP when UPNP_PROTOCOL is unset or empty", () => {
    setRequiredEnv();
    expect(getConfig().protocol).toBe("TCP");

    setRequiredEnv({ UPNP_PROTOCOL: "" });
    expect(getConfig().protocol).toBe("TCP");
  });

  test("accepts UDP protocol", () => {
    setRequiredEnv({ UPNP_PROTOCOL: "UDP" });
    expect(getConfig().protocol).toBe("UDP");
  });

  test("throws when protocol is invalid", () => {
    setRequiredEnv({ UPNP_PROTOCOL: "ICMP" });
    expect(() => getConfig()).toThrow(/Invalid protocol/);
  });

  test("parses integer env vars and rejects non-integers", () => {
    setRequiredEnv({
      UPNP_EXTERNAL_PORT: "1234",
      UPNP_INTERNAL_PORT: "4321",
      UPNP_LEASE_TIME_IN_MS: "15000",
    });

    const config = getConfig();
    expect(config.externalPort).toBe(1234);
    expect(config.internalPort).toBe(4321);
    expect(config.leaseTimeInMs).toBe(15000);

    setRequiredEnv({ UPNP_EXTERNAL_PORT: "not-a-number" });
    expect(() => getConfig()).toThrow(/UPNP_EXTERNAL_PORT.*integer/);
  });

  test("treats empty required env vars as missing", () => {
    setRequiredEnv({ UPNP_INTERNAL_IP: "" });
    expect(() => getConfig()).toThrow(/UPNP_INTERNAL_IP/);
  });
});
