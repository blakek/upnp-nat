import { beforeEach, describe, expect, mock, test } from "bun:test";

type RunHandler = (
  action: string,
  args: [string, string | number][],
) =>
  | { ok: true; response: any }
  | { ok: false; error: Error }
  | Promise<{ ok: true; response: any } | { ok: false; error: Error }>;

let lastDescriptionUrl: string | undefined;
let lastCalls: Array<{ action: string; args: [string, string | number][] }> =
  [];
let handler: RunHandler;

mock.module("nat-upnp", () => {
  return {
    device: {
      create: (descriptionUrl: string) => {
        lastDescriptionUrl = descriptionUrl;
        return {
          run: (
            action: string,
            args: [string, string | number][],
            cb: (err: any, result?: any) => void,
          ) => {
            lastCalls.push({ action, args });
            Promise.resolve(handler(action, args))
              .then((result) => {
                if (result.ok) cb(null, result.response);
                else cb(result.error);
              })
              .catch((error) => cb(error));
          },
        };
      },
    },
  };
});

const upnp = await import("./upnp");
const { Gateway, isProtocol } = upnp;

afterEachReset();

function afterEachReset() {
  beforeEach(() => {
    lastDescriptionUrl = undefined;
    lastCalls = [];
    handler = () => ({ ok: false, error: new Error("No handler set") });
  });
}

function argsToObject(args: [string, string | number][]) {
  return Object.fromEntries(args) as Record<string, string | number>;
}

describe("isProtocol", () => {
  test("accepts TCP and UDP only", () => {
    expect(isProtocol("TCP")).toBe(true);
    expect(isProtocol("UDP")).toBe(true);
    expect(isProtocol("tcp")).toBe(false);
    expect(isProtocol("ICMP")).toBe(false);
    expect(isProtocol(undefined)).toBe(false);
  });
});

describe("Gateway", () => {
  test("constructs using the provided description URL", async () => {
    handler = (action) => {
      if (action === "GetExternalIPAddress") {
        return {
          ok: true,
          response: {
            "u:GetExternalIPAddressResponse": {
              "@": { xmlns: "urn:schemas-upnp-org:service:WANIPConnection:1" },
              NewExternalIPAddress: "203.0.113.1",
            },
          },
        };
      }

      return { ok: false, error: new Error(`Unexpected action: ${action}`) };
    };

    const gateway = new Gateway("http://example.test/description.xml");
    expect(lastDescriptionUrl).toBe("http://example.test/description.xml");

    const ip = await gateway.getExternalIp();
    expect(ip).toBe("203.0.113.1");
  });

  test("createPortMapping builds correct AddPortMapping payload", async () => {
    handler = (action, args) => {
      if (action !== "AddPortMapping") {
        return { ok: false, error: new Error(`Unexpected action: ${action}`) };
      }

      const obj = argsToObject(args);

      expect(obj.NewEnabled).toBe(1);
      expect(obj.NewExternalPort).toBe(8443);
      expect(obj.NewInternalClient).toBe("10.0.2.4");
      expect(obj.NewInternalPort).toBe(3000);
      expect(obj.NewLeaseDuration).toBe(15); // 15000ms -> 15s
      expect(obj.NewProtocol).toBe("TCP"); // default
      expect(obj.NewRemoteHost).toBe("");
      expect(String(obj.NewPortMappingDescription)).toMatch(
        /^Port Mapping for 10\.0\.2\.4:3000 created /,
      );

      return {
        ok: true,
        response: {
          "u:AddPortMappingResponse": {
            "@": { xmlns: "urn:schemas-upnp-org:service:WANIPConnection:1" },
          },
        },
      };
    };

    const gateway = new Gateway("http://example.test/description.xml");

    await gateway.createPortMapping({
      externalPort: 8443,
      internalIp: "10.0.2.4",
      internalPort: 3000,
      leaseTimeInMs: 15000,
    });

    expect(lastCalls.map((c) => c.action)).toEqual(["AddPortMapping"]);
  });

  test("fetchPortMappings tolerates missing index 0 and yields from index 1", async () => {
    handler = (action, args) => {
      if (action !== "GetGenericPortMappingEntry") {
        return { ok: false, error: new Error(`Unexpected action: ${action}`) };
      }

      const { NewPortMappingIndex } = argsToObject(args);

      if (NewPortMappingIndex === 0) {
        return { ok: false, error: new Error("NoSuchEntry") };
      }

      if (NewPortMappingIndex === 1) {
        return {
          ok: true,
          response: {
            "u:GetGenericPortMappingEntryResponse": {
              NewEnabled: true,
              NewExternalPort: 1234,
              NewInternalClient: "10.0.2.4",
              NewInternalPort: 4321,
              NewLeaseDuration: 0,
              NewPortMappingDescription: "test",
              NewProtocol: "TCP",
              NewRemoteHost: "",
            },
          },
        };
      }

      return { ok: false, error: new Error("End") };
    };

    const gateway = new Gateway("http://example.test/description.xml");

    const results: any[] = [];
    for await (const mapping of gateway.fetchPortMappings()) {
      results.push(mapping);
    }

    expect(results).toHaveLength(1);
    expect(results[0].NewExternalPort).toBe(1234);

    const indices = lastCalls
      .filter((c) => c.action === "GetGenericPortMappingEntry")
      .map((c) => argsToObject(c.args).NewPortMappingIndex);

    expect(indices).toEqual([0, 1, 2]);
  });

  test("throws when the gateway returns an invalid response envelope", async () => {
    handler = (action) => {
      if (action === "GetExternalIPAddress") {
        return { ok: true, response: {} };
      }

      return { ok: false, error: new Error(`Unexpected action: ${action}`) };
    };

    const gateway = new Gateway("http://example.test/description.xml");
    await expect(gateway.getExternalIp()).rejects.toThrow(
      /Invalid response for GetExternalIPAddress/,
    );
  });
});
