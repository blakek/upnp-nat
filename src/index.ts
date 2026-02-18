import { type CreatePortMappingOptions, Gateway } from "./upnp";

const wantedPortMapping: CreatePortMappingOptions = {
  internalPort: 443,
  internalIp: "10.0.2.4",
  externalPort: 443,
  description: "Caddy reverse proxy",
  protocol: "TCP",
};

const gateway = new Gateway("http://10.0.0.10:38400/description.xml");

await gateway.createPortMapping(wantedPortMapping);

console.log("Fetching port mappings...");
for await (const portMapping of gateway.fetchPortMappings()) {
  console.log(portMapping);
}
