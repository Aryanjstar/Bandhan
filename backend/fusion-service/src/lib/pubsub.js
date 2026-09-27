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

async function publishToDog(dogId, payload) {
  const client = await getClient();
  await client.group(`dog-${dogId}`).sendToAll(payload, { contentType: "application/json" });
}

module.exports = { publishToDog };
