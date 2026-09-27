const { app } = require("@azure/functions");
const { processMessage } = require("../lib/telemetryProcessor");

// Local-dev-only stand-in for the IoT Hub -> Event Hub delivery path (fusionTrigger.js).
// api-service's sensor-data endpoint forwards here so the collar can hit a plain HTTP
// URL over the local WiFi network instead of provisioning a real IoT Hub device.
app.http("localIngest", {
  route: "ingest",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    let message;
    try {
      message = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "invalid JSON body" } };
    }
    if (!message?.dogId) {
      return { status: 400, jsonBody: { error: "dogId is required" } };
    }
    try {
      await processMessage(message, context);
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      context.error("local ingest failed", { message, err: err.message });
      return { status: 500, jsonBody: { error: err.message || "internal error" } };
    }
  },
});
