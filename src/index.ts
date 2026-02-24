import { type CreatePortMappingOptions, Gateway } from "./upnp";

const wantedPortMapping: CreatePortMappingOptions = {
  description: "Caddy reverse proxy",
  externalPort: 443,
  internalIp: "10.0.2.4",
  internalPort: 443,
  protocol: "TCP",
};

const gateway = new Gateway("http://10.0.0.10:38400/description.xml");

await gateway.createPortMapping(wantedPortMapping);

console.log("Fetching port mappings...");
for await (const portMapping of gateway.fetchPortMappings()) {
  console.log(portMapping);
}
