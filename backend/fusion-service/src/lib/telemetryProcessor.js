const cosmos = require("./cosmos");
const { classify, alertTier } = require("./fusionLogic");
const { shouldPush } = require("./alertGate");
const { publishToDog } = require("./pubsub");
const { notifyOwner } = require("./push");
const { resolveMatch, findCueDefinition } = require("./commandVerification");

const LOW_BATTERY_PCT = 15;

async function loadBaseline(dogId) {
  try {
    const { resource } = await cosmos.baselines.item(dogId, dogId).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function upsertDeviceStatus(message, context) {
  if (message.deviceId == null) return;
  try {
    const { resource: device } = await cosmos.devices.item(message.dogId, message.dogId).read();
    const updated = {
      ...(device || { id: message.dogId, dogId: message.dogId, deviceId: message.deviceId }),
      lastSeenAt: message.timestamp,
      ...(message.batteryPct != null ? { batteryPct: message.batteryPct } : {}),
    };
    await cosmos.devices.items.upsert(updated);
  } catch (err) {
    context.error("device status upsert failed", err);
  }
}

async function handleLowBattery(message, context) {
  if (message.batteryPct == null || message.batteryPct >= LOW_BATTERY_PCT) return;
  const event = {
    id: `${message.dogId}-lowbatt-${message.timestamp}`,
    dogId: message.dogId,
    timestamp: message.timestamp,
    class: "low_battery",
    confidence: 1,
    sourceSignals: [],
    feedback: "unset",
    pushed: true,
  };
  await cosmos.events.items.upsert(event);
  await publishToDog(message.dogId, { type: "event", event });
  const { resource: dog } = await cosmos.dogs.item(message.dogId, message.dogId).read().catch(() => ({ resource: null }));
  if (dog?.ownerId) {
    const { resource: owner } = await cosmos.owners.item(dog.ownerId, dog.ownerId).read().catch(() => ({ resource: null }));
    if (owner) await notifyOwner(owner, { title: "Low battery", body: `${dog.name || "Your dog"}'s collar is below ${LOW_BATTERY_PCT}%.`, event });
  }
}

// Wellness check-in (dogCheckIn.js): while device.checkInUntil hasn't elapsed, every
// telemetry tick — not just anomaly ticks — gets republished live to the dashboard.
// The firmware is also posting far more often during this window (collar.ino's
// CHECKIN_POST_INTERVAL_MS), so this is genuinely a dense live stream of real
// accel/gyro-derived motion, not just the normal duty-cycled trickle.
async function publishCheckInStatus(message, context) {
  const { resource: device } = await cosmos.devices.item(message.dogId, message.dogId).read().catch(() => ({ resource: null }));
  if (!device?.checkInUntil || new Date(device.checkInUntil).getTime() < Date.now()) return;
  await publishToDog(message.dogId, {
    type: "checkInStatus",
    dogId: message.dogId,
    motionClass: message.motionClass,
    motionEnergy: message.motionEnergy,
    stillDurationSec: message.stillDurationSec,
    timestamp: message.timestamp,
  });
}

async function handleTelemetry(message, context) {
  await upsertDeviceStatus(message, context);
  await handleLowBattery(message, context);
  await publishCheckInStatus(message, context);

  const baseline = await loadBaseline(message.dogId);
  const { eventClass, confidence, sourceSignals } = classify({
    motionClass: message.motionClass,
    vocalClass: message.vocalClass,
    stillDurationSec: message.stillDurationSec,
    baseline,
  });

  if (eventClass === "normal") return; // PRD §12: normal readings aren't logged as events

  const tier = alertTier(eventClass);
  // PRD FR-4.2 cold-start: log everything, but only push through the hard motion-energy
  // ceiling until the baseline is trained — never claim baseline-driven confidence early.
  const inColdStart = baseline?.learning === true;
  const coldStartOverride = inColdStart && (message.motionEnergy ?? 0) >= (baseline?.hardCeilingMotionEnergy ?? Infinity);
  const eligibleToPush = tier.push === true || (tier.push === "after_threshold");
  const wouldPush = inColdStart ? coldStartOverride && eligibleToPush : eligibleToPush;

  const pushed = wouldPush
    ? await shouldPush({ eventsContainer: cosmos.events, dogId: message.dogId, eventClass })
    : false;

  const event = {
    id: `${message.dogId}-${message.timestamp}`,
    dogId: message.dogId,
    timestamp: message.timestamp,
    class: eventClass,
    confidence,
    sourceSignals,
    feedback: "unset",
    pushed,
    learning: inColdStart,
  };
  await cosmos.events.items.upsert(event);
  await publishToDog(message.dogId, { type: "event", event });

  if (pushed) {
    const { resource: dog } = await cosmos.dogs.item(message.dogId, message.dogId).read().catch(() => ({ resource: null }));
    if (dog?.ownerId) {
      const { resource: owner } = await cosmos.owners.item(dog.ownerId, dog.ownerId).read().catch(() => ({ resource: null }));
      if (owner) {
        await notifyOwner(owner, {
          title: eventClass === "distress" ? "Distress detected" : "Check in on your dog",
          body: `${dog.name || "Your dog"}: ${eventClass.replace("_", " ")} (${sourceSignals.join(", ") || "motion"})`,
          event,
        });
      }
    }
  }
}

async function handleCommandResponse(message, context) {
  const { resource: dog } = await cosmos.dogs.item(message.dogId, message.dogId).read().catch(() => ({ resource: null }));
  const cueDef = findCueDefinition(dog, message.cue);
  const matchResult = resolveMatch(cueDef, message.observedPosture);
  const session = {
    id: message.cueSessionId,
    dogId: message.dogId,
    cue: message.cue,
    timestamp: message.timestamp,
    observedPosture: message.observedPosture,
    matchResult,
  };
  await cosmos.commandSessions.items.upsert(session);
  await publishToDog(message.dogId, { type: "commandSession", session });
}

async function processMessage(message, context) {
  if (message.type === "command_response") {
    await handleCommandResponse(message, context);
  } else {
    await handleTelemetry(message, context);
  }
}

module.exports = { processMessage, handleTelemetry, handleCommandResponse };
