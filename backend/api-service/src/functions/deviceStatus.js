const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { json, errorResponse } = require("../lib/respond");

const STALE_AFTER_MS = 10 * 60 * 1000; // no telemetry in 10 min => treat as offline

app.http("deviceStatus", {
  route: "devices/{id}/status",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id; // devices container is keyed by dogId (§5)
      await requireOwnedDog(dogId, ownerId);

      const { resource: device } = await cosmos.devices.item(dogId, dogId).read().catch(() => ({ resource: null }));
      if (!device) return json(404, { error: "no device paired to this dog" });

      const lastSeenMs = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : null;
      const connectivity = lastSeenMs && Date.now() - lastSeenMs < STALE_AFTER_MS ? "online" : "offline";

      return json(200, { device: { ...device, connectivity } });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
