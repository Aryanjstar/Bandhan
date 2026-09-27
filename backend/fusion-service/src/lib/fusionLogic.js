// PRD FR-3.1 (fusion score) and §12 (alert tiers). Motion-only or vocal-only distress
// signals must each be able to escalate to `distress` on their own — neither channel
// is allowed to average the other one down.
const DISTRESS_VOCAL_CLASSES = new Set(["whine_cry", "distress_bark"]);

function classify({ motionClass, vocalClass, stillDurationSec, baseline }) {
  const sourceSignals = [];
  if (motionClass && motionClass !== "normal") sourceSignals.push("motion");
  if (DISTRESS_VOCAL_CLASSES.has(vocalClass)) sourceSignals.push("vocal");

  if (motionClass === "distress" || DISTRESS_VOCAL_CLASSES.has(vocalClass)) {
    const bothSignal = motionClass === "distress" && DISTRESS_VOCAL_CLASSES.has(vocalClass);
    return { eventClass: "distress", confidence: bothSignal ? 0.95 : 0.8, sourceSignals };
  }

  // PRD §12 sustained stillness: no motion + no vocal activity longer than the
  // dog's own learned rest pattern (never a fixed global threshold, PRD §5 rule 3).
  const restCeilingSec = baseline && !baseline.learning
    ? baseline.restDurationP95Sec
    : baseline?.hardCeilingRestSec ?? 4 * 3600;
  if (motionClass === "normal" && vocalClass === "silence" && stillDurationSec >= restCeilingSec) {
    return { eventClass: "sustained_stillness", confidence: 0.6, sourceSignals: ["motion"] };
  }

  if (motionClass === "minor_anomaly") {
    return { eventClass: "minor_anomaly", confidence: 0.5, sourceSignals: sourceSignals.length ? sourceSignals : ["motion"] };
  }

  return { eventClass: "normal", confidence: 0.9, sourceSignals: [] };
}

// PRD §12 alert table: only `distress` pushes unconditionally; sustained_stillness
// pushes after a configurable threshold (owner settings), minor_anomaly never pushes.
function alertTier(eventClass) {
  switch (eventClass) {
    case "distress":
      return { beep: "long", push: true };
    case "sustained_stillness":
      return { beep: "short", push: "after_threshold" };
    case "minor_anomaly":
      return { beep: "short", push: false };
    default:
      return { beep: "none", push: false };
  }
}

module.exports = { classify, alertTier, DISTRESS_VOCAL_CLASSES };
