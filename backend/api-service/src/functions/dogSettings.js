const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { updateDeviceTwin } = require("../lib/iothub");
const { json, errorResponse } = require("../lib/respond");

// PRD FR-6.3: sensitivity changes propagate to the collar without a firmware reflash —
// written straight through to the device twin's desired properties.
app.http("dogSettings", {
  route: "dogs/{id}/settings",
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      const dog = await requireOwnedDog(dogId, ownerId);

      if (request.method === "GET") {
        return json(200, { settings: dog.settings || defaultSettings() });
      }

      const body = await request.json();
      const settings = { ...defaultSettings(), ...(dog.settings || {}), ...body };
      dog.settings = settings;
      await cosmos.dogs.items.upsert(dog);

      const { resource: device } = await cosmos.devices.item(dogId, dogId).read().catch(() => ({ resource: null }));
      if (device?.deviceId) {
        await updateDeviceTwin(device.deviceId, { settings });
      }

      return json(200, { settings });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

function defaultSettings() {
  return {
    sensitivity: { minor_anomaly: "medium", distress: "medium", sustained_stillness: "medium" },
    quietHours: null,
    alertRateCapPerHour: 1,
  };
}
