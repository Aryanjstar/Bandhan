const webpush = require("web-push");
const { getSecret } = require("./secrets");

let configured = false;

async function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY || (await getSecret("vapid-public-key"));
  const privateKey = process.env.VAPID_PRIVATE_KEY || (await getSecret("vapid-private-key"));
  const subject = process.env.VAPID_SUBJECT || "mailto:aryanjstar3@gmail.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// `owner.pushSubscriptions` holds browser-registered Web Push subscription objects
// (PRD FR-6.1 push notifications land even if the dashboard tab is closed).
async function notifyOwner(owner, payload) {
  if (!owner?.pushSubscriptions?.length) return { sent: 0 };
  await ensureConfigured();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    owner.pushSubscriptions.map((sub) => webpush.sendNotification(sub, body))
  );
  return { sent: results.filter((r) => r.status === "fulfilled").length };
}

module.exports = { notifyOwner };
