const { app } = require("@azure/functions");
const crypto = require("crypto");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { requireOwnedDog } = require("../lib/ownership");
const { sendCommand } = require("../lib/iothub");
const { json, errorResponse } = require("../lib/respond");

const RESPONSE_WINDOW_SEC = 60;

// PRD §11: defaults only — an owner's dog.settings.cues (seeded by dogSettings.js
// defaultCues()) is the real source of truth so renamed/added cues validate here too.
const FALLBACK_CUES = [
  { id: "sit", label: "Sit", beepPattern: "single", expectedPosture: "stationary", approximate: false },
  { id: "handshake", label: "Handshake", beepPattern: "continuous", expectedPosture: "paw_raised", approximate: false },
];

// PRD FR-5.1/FR-5.2: send a cue, then watch dual-IMU posture for a configurable window.
// The C2D send succeeding does NOT mean the collar received it (SYSTEM_DESIGN §9.3) —
// the commandSessions doc starts `pending` and a timer sweep (commandTimeoutSweep.js)
// resolves it to `timeout` if no observed-posture response lands in time.
app.http("dogCommand", {
  route: "dogs/{id}/command",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      const dog = await requireOwnedDog(dogId, ownerId);

      const body = await request.json();
      const cues = dog.settings?.cues?.length ? dog.settings.cues : FALLBACK_CUES;
      const cueDef = cues.find((c) => c.id === body.cue);
      if (!cueDef) return json(400, { error: `cue must be one of: ${cues.map((c) => c.id).join(", ")}` });

      const { resource: device } = await cosmos.devices.item(dogId, dogId).read().catch(() => ({ resource: null }));
      if (!device?.deviceId) return json(409, { error: "no device paired to this dog" });

      const cueSessionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const session = {
        id: cueSessionId,
        dogId,
        cue: cueDef.id,
        timestamp,
        observedPosture: null,
        matchResult: "pending",
        responseWindowSec: RESPONSE_WINDOW_SEC,
      };
      await cosmos.commandSessions.items.upsert(session);

      await sendCommand(device.deviceId, {
        type: "command",
        cueSessionId,
        cue: cueDef.id,
        beepPattern: cueDef.beepPattern,
        responseWindowSec: RESPONSE_WINDOW_SEC,
      });

      return json(202, { session });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

app.http("dogCommandSessions", {
  route: "dogs/{id}/command-sessions",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      await requireOwnedDog(dogId, ownerId);

      const limit = Math.min(parseInt(request.query.get("limit") || "50", 10), 200);
      const { resources } = await cosmos.commandSessions.items
        .query(
          { query: "SELECT TOP @limit * FROM c WHERE c.dogId = @dogId ORDER BY c.timestamp DESC",
            parameters: [{ name: "@limit", value: limit }, { name: "@dogId", value: dogId }] },
          { partitionKey: dogId }
        )
        .fetchAll();
      return json(200, { commandSessions: resources });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
