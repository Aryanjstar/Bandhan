const { WebPubSubServiceClient } = require("@azure/web-pubsub");
const { getSecret } = require("./secrets");

let clientPromise;

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connectionString = process.env.WEBPUBSUB_CONNECTION || (await getSecret("webpubsub-connection"));
      return new WebPubSubServiceClient(connectionString, "bandhan");
    })();
  }
  return clientPromise;
}

// SYSTEM_DESIGN §7: "the dashboard opens a Web PubSub connection on load" — this hands
// the browser a scoped client access URL for exactly that owner's dog's group.
async function getClientAccessUrl(dogId) {
  const client = await getClient();
  const token = await client.getClientAccessToken({ groups: [`dog-${dogId}`] });
  return token.url;
}

// Used by dogCheckIn.js to tell an already-open dashboard a wellness check-in just
// started, before the first telemetryProcessor.js-published checkInStatus tick lands.
async function publishToDog(dogId, payload) {
  const client = await getClient();
  await client.group(`dog-${dogId}`).sendToAll(payload, { contentType: "application/json" });
}

module.exports = { getClientAccessUrl, publishToDog };
