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
        try {
          await updateDeviceTwin(device.deviceId, { settings });
        } catch (err) {
          context.log("device twin update skipped (no IoT Hub device provisioned yet)", err.message);
        }
      }

      return json(200, { settings });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

// PRD §11: shipped defaults, not a lock — owners can rename, retarget, or add cues.
// `approximate` stays hardcoded true for any cue an owner sets expectedPosture:
// "approached" on (lib/commandVerification.js enforces this server-side too; it
// can't be defeated by what's stored here).
function defaultCues() {
  return [
    { id: "sit", label: "Sit", beepPattern: "single", expectedPosture: "stationary", approximate: false },
    { id: "handshake", label: "Handshake", beepPattern: "continuous", expectedPosture: "paw_raised", approximate: false },
  ];
}

function defaultSettings() {
  return {
    sensitivity: { minor_anomaly: "medium", distress: "medium", sustained_stillness: "medium" },
    quietHours: null,
    alertRateCapPerHour: 1,
    cues: defaultCues(),
  };
}
