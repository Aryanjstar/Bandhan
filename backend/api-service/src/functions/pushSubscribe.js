const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { getClientAccessUrl } = require("../lib/pubsub");
const { json, errorResponse } = require("../lib/respond");

// Browser registers its Web Push subscription here (SYSTEM_DESIGN §2/§6: "Push, VAPID").
app.http("pushSubscribe", {
  route: "push/subscribe",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const subscription = await request.json();
      if (!subscription?.endpoint) return json(400, { error: "invalid push subscription" });

      const { resource: owner } = await cosmos.owners.item(ownerId, ownerId).read();
      const existing = owner.pushSubscriptions || [];
      if (!existing.some((s) => s.endpoint === subscription.endpoint)) {
        owner.pushSubscriptions = [...existing, subscription];
        await cosmos.owners.items.upsert(owner);
      }
      return json(200, { subscribed: true });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

// SYSTEM_DESIGN §7: "the dashboard opens a Web PubSub connection on load" — client
// asks here first for a scoped, short-lived connection URL.
app.http("realtimeNegotiate", {
  route: "dogs/{id}/realtime-negotiate",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      const { requireOwnedDog } = require("../lib/ownership");
      await requireOwnedDog(dogId, ownerId);
      const url = await getClientAccessUrl(dogId);
      return json(200, { url });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
