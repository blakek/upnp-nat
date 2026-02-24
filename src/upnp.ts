import { device } from "nat-upnp";
import { promisify } from "util";

export type Protocol = "TCP" | "UDP";

export interface CreatePortMappingOptions {
  /** Optional description for the port mapping. If not provided, a default description will be generated. */
  description?: string;
  /** External port to map (i.e. what port the gateway should listen on). */
  externalPort: number;
  /** Internal IP address to map (i.e. what IP the gateway should forward to). */
  internalIp: string;
  /** Internal port to map (i.e. what port the gateway should forward to). */
  internalPort: number;
  /** Lease time for the port mapping in milliseconds. If not provided, the mapping will use the gateway's default lease time (often no expiration). */
  leaseTimeInMs?: number;
  /** Protocol for the port mapping. If not provided, defaults to TCP. */
  protocol?: Protocol;
}

type TaggedUnion<
  TypeIdentifier extends string,
  Types extends Record<string, unknown>,
> = {
  [Name in keyof Types]: Record<TypeIdentifier, Name> & Types[Name];
}[keyof Types];

type Commands = TaggedUnion<
  "action",
  {
    AddPortMapping: {
      NewEnabled: 1 | 0;
      NewExternalPort: number;
      NewInternalClient: string;
      NewInternalPort: number;
      NewLeaseDuration: number;
      NewPortMappingDescription: string;
      NewProtocol: Protocol;
      NewRemoteHost: string;
    };
    GetExternalIPAddress: {};
    GetGenericPortMappingEntry: {
      NewPortMappingIndex: number;
    };
  }
>;

type Responses = TaggedUnion<
  "action",
  {
    GetExternalIPAddress: {
      NewExternalIPAddress: string;
    };
    AddPortMapping: {};
    GetGenericPortMappingEntry: {
      NewEnabled: boolean;
      NewExternalPort: number;
      NewInternalClient: string;
      NewInternalPort: number;
      NewLeaseDuration: number;
      NewPortMappingDescription: string;
      NewProtocol: Protocol;
      NewRemoteHost: string;
    };
  }
>;

export function isProtocol(value: unknown): value is Protocol {
  return value === "TCP" || value === "UDP";
}

export class Gateway {
  private readonly run: <Action extends Commands["action"]>(
    action: Action,
    args: [string, string | number][],
  ) => Promise<any>;

  /** Execute a UPnP action on the gateway. */
  private async gatewayCommand<
    Action extends Commands["action"],
    Args extends Omit<Extract<Commands, { action: Action }>, "action">,
    Response extends Omit<Extract<Responses, { action: Action }>, "action">,
  >(action: Action, input: Args): Promise<Response> {
    // @ts-expect-error - Ensure the action is really gone.
    delete input.action;

    const args = Object.entries(input) as [string, string | number][];
    const rawResponse = await this.run(action, args);
    const key = `u:${action}Response`;

    if (
      rawResponse === undefined ||
      rawResponse === null ||
      !rawResponse[key]
    ) {
      throw new TypeError(`Invalid response for ${action}`, {
        cause: rawResponse,
      });
    }

    const response = rawResponse[key] as any;
    delete response["@"];
    return response;
  }

  private defaultDescription(options: CreatePortMappingOptions): string {
    return `Port Mapping for ${options.internalIp}:${options.internalPort} created ${new Date().toISOString()}`;
  }

  constructor(public readonly descriptionUrl: string) {
    const gateway = device.create(descriptionUrl);
    this.run = promisify(gateway.run.bind(gateway));
  }

  async *fetchPortMappings() {
    let index = 0;

    while (true) {
      try {
        yield await this.gatewayCommand("GetGenericPortMappingEntry", {
          NewPortMappingIndex: index,
        });
      } catch (error) {
        // Some gateways have a 1-based index
        if (index > 0) {
          break;
        }
      }
      index++;
    }
  }

  async getExternalIp() {
    const { NewExternalIPAddress } = await this.gatewayCommand(
      "GetExternalIPAddress",
      {},
    );

    return NewExternalIPAddress;
  }

  async createPortMapping(options: CreatePortMappingOptions): Promise<void> {
    await this.gatewayCommand("AddPortMapping", {
      NewEnabled: 1,
      NewExternalPort: options.externalPort,
      NewInternalClient: options.internalIp,
      NewInternalPort: options.internalPort,
      NewLeaseDuration: Math.floor((options.leaseTimeInMs ?? 0) / 1000),
      NewPortMappingDescription:
        options.description ?? this.defaultDescription(options),
      NewProtocol: options.protocol ?? "TCP",
      NewRemoteHost: "",
    });
  }
}
