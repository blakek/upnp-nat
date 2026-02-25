import { getConfig } from "./config";
import { Gateway } from "./upnp";

const config = getConfig();
const { gatewayDescriptionUrl, ...wantedPortMapping } = config;

const gateway = new Gateway(gatewayDescriptionUrl);

await gateway.createPortMapping(wantedPortMapping);

console.log("Fetching port mappings...");
for await (const portMapping of gateway.fetchPortMappings()) {
  console.log(portMapping);
}
