// PRD FR-5.2 + SYSTEM_DESIGN §9.4: "come" is posture-only, no GPS — a successful
// "come" must be labeled `approximate_match`, never plain `match`, so no downstream
// view can accidentally present it as location-confirmed.
function resolveMatch(cue, observedPosture) {
  if (cue === "sit") {
    return observedPosture === "stationary" ? "match" : "no_match";
  }
  if (cue === "come") {
    return observedPosture === "approached" ? "approximate_match" : "no_match";
  }
  return "no_match";
}

module.exports = { resolveMatch };
