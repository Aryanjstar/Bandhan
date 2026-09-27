const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { publishToDog } = require("../lib/pubsub");

// SYSTEM_DESIGN §9.3: if the collar never comes online for a sent cue, this must
// resolve to `timeout`, never `no_match` — a timeout is not the dog ignoring the cue.
app.timer("commandTimeoutSweep", {
  schedule: "0 * * * * *", // every minute
  handler: async (_timer, context) => {
    const { resources: pending } = await cosmos.commandSessions.items
      .query({ query: "SELECT * FROM c WHERE c.matchResult = 'pending'" })
      .fetchAll();

    const now = Date.now();
    for (const session of pending) {
      const deadline = new Date(session.timestamp).getTime() + (session.responseWindowSec || 60) * 1000;
      if (now < deadline) continue;
      session.matchResult = "timeout";
      await cosmos.commandSessions.items.upsert(session);
      await publishToDog(session.dogId, { type: "commandSession", session }).catch((err) => context.error(err));
    }
  },
});
