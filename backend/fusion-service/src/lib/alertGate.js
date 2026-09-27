const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000; // PRD §9.5 default: max 1 push/hour outside distress tier

// PRD §14 "Repeated borderline readings inside the post-alert cooldown → logged, not
// re-pushed." Distress and low-battery are exempt — §12/§14 rank them above alert fatigue.
async function shouldPush({ eventsContainer, dogId, eventClass, cooldownMs = DEFAULT_COOLDOWN_MS }) {
  if (eventClass === "distress" || eventClass === "low_battery") return true;

  const { resources } = await eventsContainer.items
    .query({
      query:
        "SELECT TOP 1 c.timestamp FROM c WHERE c.dogId = @dogId AND c.pushed = true ORDER BY c.timestamp DESC",
      parameters: [{ name: "@dogId", value: dogId }],
    }, { partitionKey: dogId })
    .fetchAll();

  if (!resources.length) return true;
  const lastPushedAt = new Date(resources[0].timestamp).getTime();
  return Date.now() - lastPushedAt >= cooldownMs;
}

module.exports = { shouldPush, DEFAULT_COOLDOWN_MS };
