const { app } = require("@azure/functions");
const { json, errorResponse } = require("../lib/respond");

// The collar (ESP32) posts telemetry here over the local WiFi network. This stands in
// for the IoT Hub device-to-cloud MQTT uplink (SYSTEM_DESIGN.md) while there's no real
// IoT Hub device provisioned yet — it forwards straight to fusion-service's local ingest
// endpoint, matching the same ingestion -> fusion boundary the production path uses.
const FUSION_LOCAL_URL = process.env.FUSION_LOCAL_URL || "http://localhost:7072/api/ingest";

app.http("sensorData", {
  route: "sensor-data",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    let message;
    try {
      message = await request.json();
    } catch {
      return json(400, { error: "invalid JSON body" });
    }
    if (!message?.dogId) {
      return json(400, { error: "dogId is required" });
    }
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    try {
      const res = await fetch(FUSION_LOCAL_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        context.error("fusion-service rejected telemetry", { status: res.status, body });
        return json(502, { error: "fusion-service rejected telemetry" });
      }
      return json(202, { ok: true });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
