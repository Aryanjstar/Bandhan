const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { json, errorResponse } = require("../lib/respond");

// Device-facing (anonymous, like sensorData.js) — the collar polls this instead of
// holding a persistent connection, since there's no local push channel yet. At-most-
// once delivery: the pending command is cleared as soon as it's handed back, so a
// dropped response just means the next owner check-in click tries again, never a
// duplicate beep.
app.http("devicePendingCommand", {
  route: "devices/{deviceId}/pending-command",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const deviceId = request.params.deviceId;
      // `devices` is partitioned by /dogId (SYSTEM_DESIGN §5), and the collar only
      // knows its own deviceId — cross-partition lookup is the price of that shape.
      // PRD §15 says one collar maps to one dog, but re-pairing the same physical
      // deviceId to a different dog creates a new document rather than moving the
      // old one (dogsPairDevice.js), so stale rows for the same deviceId can linger —
      // ORDER BY _ts DESC picks whichever pairing was written most recently.
      const { resources } = await cosmos.devices.items
        .query({ query: "SELECT * FROM c WHERE c.deviceId = @deviceId ORDER BY c._ts DESC", parameters: [{ name: "@deviceId", value: deviceId }] })
        .fetchAll();
      const device = resources[0];
      if (!device?.pendingCommand) return json(200, { cue: null });

      const pending = device.pendingCommand;
      device.pendingCommand = null;
      await cosmos.devices.items.upsert(device);
      return json(200, pending);
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
