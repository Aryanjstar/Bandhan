const { app } = require("@azure/functions");
const { processMessage } = require("../lib/telemetryProcessor");

app.eventHub("fusionTrigger", {
  connection: "IOTHUB_EVENTHUB_CONNECTION",
  eventHubName: "%IOTHUB_EVENTHUB_NAME%",
  cardinality: "many",
  handler: async (messages, context) => {
    const batch = Array.isArray(messages) ? messages : [messages];
    for (const raw of batch) {
      const message = typeof raw === "string" ? JSON.parse(raw) : raw;
      try {
        await processMessage(message, context);
      } catch (err) {
        context.error("fusion message failed", { message, err: err.message });
      }
    }
  },
});
