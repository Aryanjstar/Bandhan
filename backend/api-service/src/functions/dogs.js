const { app } = require("@azure/functions");
const crypto = require("crypto");
const cosmos = require("../lib/cosmos");
const { requireOwner } = require("../lib/auth");
const { json, errorResponse } = require("../lib/respond");

// PRD §15: one owner, one dog, one collar in v1 — enforced here, not just in the UI.
app.http("dogs", {
  route: "dogs",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);

      if (request.method === "GET") {
        const { resources } = await cosmos.dogs.items
          .query({ query: "SELECT * FROM c WHERE c.ownerId = @ownerId", parameters: [{ name: "@ownerId", value: ownerId }] })
          .fetchAll();
        return json(200, { dogs: resources });
      }

      const { resources: existing } = await cosmos.dogs.items
        .query({ query: "SELECT * FROM c WHERE c.ownerId = @ownerId", parameters: [{ name: "@ownerId", value: ownerId }] })
        .fetchAll();
      if (existing.length > 0) return json(409, { error: "this owner already has a dog registered (v1 supports one dog per owner)" });

      const body = await request.json();
      if (!body.name) return json(400, { error: "dog name is required" });

      const dogId = crypto.randomUUID();
      const dog = {
        id: dogId,
        dogId,
        ownerId,
        name: body.name,
        breed: body.breed || null,
        breedDetail: body.breedDetail || null,
        age: body.age || null,
        // Profile metadata only (PRD §6: seeds default sensitivity thresholds,
        // never substitutes for the learned baseline in `baselines` below).
        sex: body.sex || null,
        neutered: body.neutered || null,
        ownedSince: body.ownedSince || null,
        energyLevel: body.energyLevel ?? null,
        vocalLevel: body.vocalLevel ?? null,
        whimperFrequency: body.whimperFrequency || null,
        barkTriggers: Array.isArray(body.barkTriggers) ? body.barkTriggers : [],
        temperament: Array.isArray(body.temperament) ? body.temperament : (body.temperament || null),
        aloneTimeBehavior: body.aloneTimeBehavior || null,
        aloneTimeDetail: body.aloneTimeDetail || null,
        fears: Array.isArray(body.fears) ? body.fears : [],
        createdAt: new Date().toISOString(),
      };
      await cosmos.dogs.items.create(dog);

      // Seed the baseline in `learning` state immediately (FR-4.2 cold-start) and a
      // devices placeholder so pairing (below) has something to attach the deviceId to.
      await cosmos.baselines.items.upsert({
        id: dogId,
        dogId,
        learning: true,
        learningStartedAt: dog.createdAt,
        restDurationP95Sec: null,
        hardCeilingRestSec: 4 * 3600,
        hardCeilingMotionEnergy: 9999,
        motionEnergyMean: null,
        motionEnergyVariance: null,
        barkRatePattern: null,
        snapshotAt: dog.createdAt,
      });

      return json(201, { dog });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});

// Manual pairing code entry (SYSTEM_DESIGN §9.10: DPS is deferred, this is the pilot path).
app.http("dogsPairDevice", {
  route: "dogs/{id}/pair-device",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const ownerId = await requireOwner(request);
      const dogId = request.params.id;
      const { requireOwnedDog } = require("../lib/ownership");
      await requireOwnedDog(dogId, ownerId);

      const body = await request.json();
      if (!body.deviceId) return json(400, { error: "deviceId is required" });

      await cosmos.devices.items.upsert({
        id: dogId,
        dogId,
        deviceId: body.deviceId,
        firmwareVersion: body.firmwareVersion || null,
        batteryPct: null,
        lastSeenAt: null,
        pairedAt: new Date().toISOString(),
      });
      return json(200, { paired: true, dogId, deviceId: body.deviceId });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
