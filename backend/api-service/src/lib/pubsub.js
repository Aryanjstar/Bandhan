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

module.exports = { getClientAccessUrl };
