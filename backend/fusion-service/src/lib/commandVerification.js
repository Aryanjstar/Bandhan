// PRD FR-5.2 + SYSTEM_DESIGN §5 (2026-09-27 note): the cue vocabulary is owner-
// configurable, not a hardcoded sit/come switch — `sit`/`handshake` below are only the
// seeded defaults (PRD §11). Every cue definition carries an `expectedPosture` and an
// `approximate` flag; that flag stays hardcoded true for any cue whose expectedPosture
// is `approached` (posture-only, no GPS behind it) — no per-dog configuration can turn
// an approach-type cue into a GPS-confirmed `match` (PRD §5 rule 5, doesn't relax for
// user-defined cues).
const DEFAULT_CUES = [
  { id: "sit", label: "Sit", beepPattern: "single", expectedPosture: "stationary", approximate: false },
  { id: "handshake", label: "Handshake", beepPattern: "continuous", expectedPosture: "paw_raised", approximate: false },
];

function findCueDefinition(dog, cueId) {
  const configured = dog?.settings?.cues?.find((c) => c.id === cueId);
  return configured || DEFAULT_CUES.find((c) => c.id === cueId) || null;
}

function resolveMatch(cueDef, observedPosture) {
  if (!cueDef) return "no_match";
  if (observedPosture !== cueDef.expectedPosture) return "no_match";
  const approximate = cueDef.expectedPosture === "approached" || cueDef.approximate === true;
  return approximate ? "approximate_match" : "match";
}

module.exports = { resolveMatch, findCueDefinition, DEFAULT_CUES };
