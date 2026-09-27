const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { sendCommand } = require("../lib/iothub");
const { publishToDog } = require("../lib/pubsub");
const { json, errorResponse } = require("../lib/respond");

const CHECKIN_WINDOW_MS = 15_000; // must be >= firmware/collar/collar.ino's CHECKIN_BURST_MS

// Wellness check-in: "is my dog actually okay right now, not just quiet?" — distinct
// from the sit/handshake training cues (dogCommand.js). Plays a beep to get the dog's
// attention, then the collar streams telemetry at a much higher rate for a short
// window so the dashboard shows a dense live read of real accel/gyro-derived motion
// instead of the normal duty-cycled trickle. See lib/telemetryProcessor.js for the
// live-republish side and firmware/collar/collar.ino for the on-device burst logic.
app.http("dogCheckIn", {
  route: "dogs/{id}/check-in",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      await requireOwnedDog(dogId, ownerId);

      const { resource: device } = await cosmos.devices.item(dogId, dogId).read().catch(() => ({ resource: null }));
      if (!device?.deviceId) return json(409, { error: "no device paired to this dog" });

      const checkInUntil = new Date(Date.now() + CHECKIN_WINDOW_MS).toISOString();
      device.pendingCommand = { cue: "check_in", beepPattern: "double", issuedAt: new Date().toISOString() };
      device.checkInUntil = checkInUntil;
      await cosmos.devices.items.upsert(device);

      // Best-effort: a real IoT Hub device identity delivers this immediately once
      // provisioned. Local-only collars (no IoT Hub device yet) rely entirely on the
      // poll in firmware/collar/collar.ino's pollPendingCommand() instead.
      try {
        await sendCommand(device.deviceId, { type: "command", cue: "check_in" });
      } catch (err) {
        context.log("check-in C2D send skipped (no IoT Hub device provisioned yet)", err.message);
      }

      await publishToDog(dogId, { type: "checkInStarted", dogId, until: checkInUntil });

      return json(202, { checkInUntil });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
