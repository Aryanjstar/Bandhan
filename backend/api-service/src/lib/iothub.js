const { Client: ServiceClient, Registry } = require("azure-iothub");
const { Message } = require("azure-iot-common");
const { getSecret } = require("./secrets");

let serviceClientPromise;
let registryPromise;

async function connectionString() {
  return process.env.IOTHUB_SERVICE_CONNECTION || (await getSecret("iothub-service-connection"));
}

async function getServiceClient() {
  if (!serviceClientPromise) {
    serviceClientPromise = connectionString().then((cs) => {
      const client = ServiceClient.fromConnectionString(cs);
      return client.open().then(() => client);
    });
  }
  return serviceClientPromise;
}

async function getRegistry() {
  if (!registryPromise) {
    registryPromise = connectionString().then((cs) => Registry.fromConnectionString(cs));
  }
  return registryPromise;
}

// PRD FR-5.1: send a cue (`sit` short beep / `come` long beep) as a cloud-to-device
// message. SYSTEM_DESIGN §9.3: if the collar never comes online, this must not read
// as a false no-match — the caller is responsible for the timeout sweep, not this call.
async function sendCommand(deviceId, payload) {
  const client = await getServiceClient();
  const message = new Message(JSON.stringify(payload));
  message.ack = "full";
  await client.send(deviceId, message);
}

// PRD FR-6.3: sensitivity/quiet-hours changes propagate to the collar without a
// firmware reflash — device twin desired properties are exactly that channel.
async function updateDeviceTwin(deviceId, desiredProperties) {
  const registry = await getRegistry();
  const { responseBody: twin } = await registry.getTwin(deviceId);
  twin.properties.desired = { ...twin.properties.desired, ...desiredProperties };
  await registry.updateTwin(deviceId, twin, twin.etag);
}

module.exports = { sendCommand, updateDeviceTwin };
