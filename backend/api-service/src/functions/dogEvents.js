const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { json, errorResponse } = require("../lib/respond");

app.http("dogEvents", {
  route: "dogs/{id}/events",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      await requireOwnedDog(dogId, ownerId);

      const severity = request.query.get("severity");
      const from = request.query.get("from");
      const to = request.query.get("to");
      const limit = Math.min(parseInt(request.query.get("limit") || "50", 10), 200);
      const offset = Math.max(parseInt(request.query.get("offset") || "0", 10), 0);

      const clauses = ["c.dogId = @dogId"];
      const parameters = [{ name: "@dogId", value: dogId }];
      if (severity) {
        clauses.push("c.class = @severity");
        parameters.push({ name: "@severity", value: severity });
      }
      if (from) {
        clauses.push("c.timestamp >= @from");
        parameters.push({ name: "@from", value: from });
      }
      if (to) {
        clauses.push("c.timestamp <= @to");
        parameters.push({ name: "@to", value: to });
      }

      const query = `SELECT * FROM c WHERE ${clauses.join(" AND ")} ORDER BY c.timestamp DESC OFFSET ${offset} LIMIT ${limit}`;
      const { resources } = await cosmos.events.items.query({ query, parameters }, { partitionKey: dogId }).fetchAll();
      return json(200, { events: resources, limit, offset });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

// PRD FR-6.2: owner marks any event accurate/false; feeds retrain signal, no extra page.
app.http("eventFeedback", {
  route: "events/{id}/feedback",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const eventId = request.params.id;
      const dogId = request.query.get("dogId");
      if (!dogId) return json(400, { error: "dogId query param is required (events are partitioned by dogId)" });
      await requireOwnedDog(dogId, ownerId);

      const body = await request.json();
      if (!["accurate", "false"].includes(body.feedback)) return json(400, { error: "feedback must be 'accurate' or 'false'" });

      const { resource: event } = await cosmos.events.item(eventId, dogId).read();
      if (!event) return json(404, { error: "event not found" });
      event.feedback = body.feedback;
      await cosmos.events.items.upsert(event);
      return json(200, { event });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
