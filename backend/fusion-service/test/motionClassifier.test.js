const assert = require("node:assert");
const { MotionClassifier } = require("../src/lib/motionClassifier");

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

run("rest stays normal and accumulates stillDurationSec", () => {
  const c = new MotionClassifier();
  let last;
  for (let t = 0; t <= 5000; t += 100) {
    last = c.update({ ax: 0, ay: 0, az: 1 }, t);
  }
  assert.strictEqual(last.motionClass, "normal");
  assert.ok(last.stillDurationSec >= 4 && last.stillDurationSec <= 5, `expected ~5s still, got ${last.stillDurationSec}`);
});

run("sustained pacing-level energy becomes minor_anomaly after the duration floor", () => {
  const c = new MotionClassifier();
  let last;
  for (let t = 0; t <= 25000; t += 100) {
    // az=1.7 => dynamicEnergy=0.7, above PACING_ENERGY_G (0.5)
    last = c.update({ ax: 0, ay: 0, az: 1.7 }, t);
  }
  assert.strictEqual(last.motionClass, "minor_anomaly");
});

run("repeated jerk spikes in a short window escalate to distress", () => {
  const c = new MotionClassifier();
  let mag = 1;
  let last;
  for (let i = 0; i < 5; i++) {
    mag = mag > 1 ? 1 : 5; // alternate 1g <-> 5g so consecutive jerks exceed JERK_SPIKE_G
    last = c.update({ ax: 0, ay: 0, az: mag }, i * 200);
  }
  assert.strictEqual(last.motionClass, "distress");
});

console.log("motionClassifier.test.js: all assertions passed");
