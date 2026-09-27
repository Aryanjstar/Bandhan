const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getSecret } = require("./secrets");

const MIN_LENGTH = 12;
const COMMON_PASSWORDS = new Set([
  "password123", "qwerty123456", "letmein12345", "123456789012",
  "iloveyou1234", "welcome12345", "admin1234567", "changeme1234",
]);

// PRD gives Owner only "name, unique email, password" (§6) — no bar was specified
// there, so this enforces a real strong-password policy rather than leaving it default.
function validatePasswordStrength(password, email) {
  const problems = [];
  if (!password || password.length < MIN_LENGTH) problems.push(`at least ${MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password || "")) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password || "")) problems.push("an uppercase letter");
  if (!/[0-9]/.test(password || "")) problems.push("a digit");
  if (!/[^A-Za-z0-9]/.test(password || "")) problems.push("a symbol");
  if (COMMON_PASSWORDS.has((password || "").toLowerCase())) problems.push("not a commonly used password");
  const localPart = (email || "").split("@")[0]?.toLowerCase();
  if (localPart && password && password.toLowerCase().includes(localPart)) {
    problems.push("not contain your email address");
  }
  return problems;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function signSession(ownerId) {
  const secret = process.env.JWT_SIGNING_SECRET || (await getSecret("jwt-signing-secret"));
  return jwt.sign({ sub: ownerId }, secret, { expiresIn: "7d" });
}

async function verifySession(token) {
  const secret = process.env.JWT_SIGNING_SECRET || (await getSecret("jwt-signing-secret"));
  const payload = jwt.verify(token, secret);
  return payload.sub;
}

// PRD §15 isolation: one owner account maps to exactly one collar/dog, no cross-account
// leakage — every protected route resolves ownerId here, server-side, never from the body.
async function requireOwner(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    const err = new Error("missing or malformed Authorization header");
    err.statusCode = 401;
    throw err;
  }
  try {
    return await verifySession(token);
  } catch {
    const err = new Error("invalid or expired session");
    err.statusCode = 401;
    throw err;
  }
}

module.exports = { validatePasswordStrength, hashPassword, verifyPassword, signSession, verifySession, requireOwner };
