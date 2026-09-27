#!/usr/bin/env node
// Stands in for the physical collar (firmware/collar/collar.ino) while there's no
// soldered hardware to test against — generates single-MPU6050 accel samples,
// classifies them with the exact same lib/motionClassifier.js the firmware mirrors,
// and POSTs telemetry to api-service's /api/sensor-data (backend/README.md's
// local-only collar path) at the same duty-cycled rate real firmware would use.
// Also polls /api/devices/{deviceId}/pending-command like the firmware does, so the
// wellness check-in feature (dogCheckIn.js) can be exercised end to end without hardware.
//
// Usage:
//   node simulate.js --dog <dogId> --device <deviceId> [--url http://localhost:7071] [--scenario normal|pacing|shake|rest|mixed] [--hz 20] [--post-hz 1]
//
// While running:
//   b  -> demo button: force an immediate distress alert (PRD §8 "manual mark this
//         as an event" button) regardless of what the classifier currently sees
//   q  -> quit

const { MotionClassifier } = require("../../backend/fusion-service/src/lib/motionClassifier");

const CHECKIN_POST_HZ = 4; // mirrors collar.ino's CHECKIN_POST_INTERVAL_MS (250ms)
const CHECKIN_BURST_MS = 10000; // mirrors collar.ino's CHECKIN_BURST_MS
const PENDING_COMMAND_POLL_MS = 3000; // mirrors collar.ino's PENDING_COMMAND_POLL_MS

function parseArgs(argv) {
  const args = { dog: "test-dog", device: "collar-cupid-001", url: "http://localhost:7071", scenario: "mixed", hz: 20, postHz: 1 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key === "dog") args.dog = value;
    else if (key === "device") args.device = value;
    else if (key === "url") args.url = value;
    else if (key === "scenario") args.scenario = value;
    else if (key === "hz") args.hz = Number(value);
    else if (key === "post-hz") args.postHz = Number(value);
  }
  return args;
}

// One IMU reading per scenario per tick: {ax, ay, az} in g, az carries the resting
// ~1g of gravity (collar roughly upright) — deliberately simple, this is a dev tool
// standing in for real sensor noise, not a physics simulation.
function sampleFor(scenario, elapsedSec) {
  const noise = () => (Math.random() - 0.5) * 0.02;
  if (scenario === "rest") {
    return { ax: noise(), ay: noise(), az: 1 + noise() };
  }
  if (scenario === "pacing") {
    const osc = 0.6 * Math.sin(2 * Math.PI * 1.5 * elapsedSec);
    return { ax: osc + noise(), ay: 0.2 * Math.sin(2 * Math.PI * 1.5 * elapsedSec + 1) + noise(), az: 1 + noise() };
  }
  if (scenario === "shake") {
    // The classifier watches jerk (delta between *consecutive* samples), not absolute
    // level — a real seizure-like tremor is an oscillation, so this has to swing back
    // toward baseline each tick, not just emit a fresh random high value every time
    // (a fresh random high value stays high tick-to-tick, which produces small deltas
    // despite huge absolute energy — that shape doesn't trip a jerk-based detector).
    const osc = 3.5 * Math.sin(2 * Math.PI * 6 * elapsedSec); // ~6 Hz tremor
    return { ax: osc + noise(), ay: -osc * 0.5 + noise(), az: 1 + noise() };
  }
  // "normal": gentle walking-level motion, well under the pacing/distress thresholds
  const osc = 0.08 * Math.sin(2 * Math.PI * 0.8 * elapsedSec);
  return { ax: osc + noise(), ay: 0.05 * Math.sin(2 * Math.PI * 0.8 * elapsedSec + 0.5) + noise(), az: 1 + noise() };
}

// "mixed" walks through the other scenarios so a demo doesn't need manual restarts
// to show each alert tier: 20s normal -> 20s pacing (minor_anomaly) -> 3s shake
// (distress) -> 15s rest -> repeat.
const MIXED_SCHEDULE = [
  { scenario: "normal", forSec: 20 },
  { scenario: "pacing", forSec: 20 },
  { scenario: "shake", forSec: 3 },
  { scenario: "rest", forSec: 15 },
];

function scenarioAt(elapsedSec) {
  const cycleLen = MIXED_SCHEDULE.reduce((sum, s) => sum + s.forSec, 0);
  let t = elapsedSec % cycleLen;
  for (const step of MIXED_SCHEDULE) {
    if (t < step.forSec) return step.scenario;
    t -= step.forSec;
  }
  return "normal";
}

async function postTelemetry(url, body) {
  try {
    const res = await fetch(`${url}/api/sensor-data`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`[simulator] sensor-data POST rejected: ${res.status}`);
  } catch (err) {
    console.error(`[simulator] sensor-data POST failed: ${err.message} (is api-service running on ${url}?)`);
  }
}

async function pollPendingCommand(url, deviceId, onCheckIn) {
  try {
    const res = await fetch(`${url}/api/devices/${deviceId}/pending-command`);
    if (!res.ok) return;
    const body = await res.json();
    if (body.cue === "check_in") {
      console.log("\n[simulator] check-in command received — beep beep, streaming live status");
      onCheckIn();
    }
  } catch {
    // best-effort, same as the firmware's poll — a dropped request just retries next tick
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const classifier = new MotionClassifier();
  const startMs = Date.now();
  let batteryPct = 80;
  let forcedDistressUntil = 0;
  let checkInBurstUntil = 0;
  let latest = { motionClass: "normal", motionEnergy: 0, stillDurationSec: 0 };

  console.log(`[simulator] dog=${args.dog} device=${args.device} scenario=${args.scenario} url=${args.url}`);
  console.log("[simulator] press 'b' for the demo distress button, 'q' to quit");

  const tickMs = Math.round(1000 / args.hz);
  const tickTimer = setInterval(() => {
    const elapsedSec = (Date.now() - startMs) / 1000;
    const scenario = args.scenario === "mixed" ? scenarioAt(elapsedSec) : args.scenario;
    const now = Date.now();

    latest = classifier.update(sampleFor(scenario, elapsedSec), now);
    if (now < forcedDistressUntil) latest = { ...latest, motionClass: "distress", motionEnergy: 3 };

    process.stdout.write(
      `\r[${new Date(now).toISOString().slice(11, 19)}] scenario=${scenario.padEnd(7)} motionClass=${latest.motionClass.padEnd(13)} energy=${latest.motionEnergy.toFixed(2)}g still=${latest.stillDurationSec}s battery=${batteryPct}%   `
    );
  }, tickMs);

  const postTick = () => {
    batteryPct = Math.max(0, batteryPct - 0.05); // slow drain, just for the low-battery alert path to be reachable in a long demo
    postTelemetry(args.url, {
      dogId: args.dog,
      deviceId: args.device,
      motionClass: latest.motionClass,
      vocalClass: "silence",
      stillDurationSec: latest.stillDurationSec,
      motionEnergy: latest.motionEnergy,
      batteryPct: Math.round(batteryPct),
    });
  };
  let postTimer = setInterval(postTick, Math.round(1000 / args.postHz));

  const pendingTimer = setInterval(() => {
    pollPendingCommand(args.url, args.device, () => {
      checkInBurstUntil = Date.now() + CHECKIN_BURST_MS;
      clearInterval(postTimer);
      postTimer = setInterval(postTick, Math.round(1000 / CHECKIN_POST_HZ));
      setTimeout(() => {
        clearInterval(postTimer);
        postTimer = setInterval(postTick, Math.round(1000 / args.postHz));
      }, CHECKIN_BURST_MS);
    });
  }, PENDING_COMMAND_POLL_MS);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (key) => {
      if (key === "b") {
        forcedDistressUntil = Date.now() + 5000; // hold the forced alert for 5s so the POST loop is guaranteed to send it at least once
        console.log("\n[simulator] demo button pressed — forcing a distress alert");
        postTelemetry(args.url, {
          dogId: args.dog,
          deviceId: args.device,
          motionClass: "distress",
          vocalClass: "distress_bark",
          stillDurationSec: 0,
          motionEnergy: 3,
          batteryPct: Math.round(batteryPct),
        });
      } else if (key === "q" || key === "\u0003") {
        clearInterval(tickTimer);
        clearInterval(postTimer);
        clearInterval(pendingTimer);
        console.log("\n[simulator] stopped");
        process.exit(0);
      }
    });
  }
}

main();
