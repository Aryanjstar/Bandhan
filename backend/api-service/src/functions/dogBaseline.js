const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { json, errorResponse } = require("../lib/respond");

app.http("dogBaseline", {
  route: "dogs/{id}/baseline",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      await requireOwnedDog(dogId, ownerId);

      const { resource: baseline } = await cosmos.baselines.item(dogId, dogId).read();
      if (!baseline) return json(404, { error: "baseline not found" });
      return json(200, { baseline });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
