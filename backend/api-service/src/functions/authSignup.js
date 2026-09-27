const { app } = require("@azure/functions");
const crypto = require("crypto");
const cosmos = require("../lib/cosmos");
const { validatePasswordStrength, hashPassword, signSession } = require("../lib/auth");
const { json, errorResponse } = require("../lib/respond");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findOwnerByEmail(email) {
  const { resources } = await cosmos.owners.items
    .query({
      query: "SELECT * FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: email.toLowerCase() }],
    })
    .fetchAll();
  return resources[0];
}

app.http("authSignup", {
  route: "auth/signup",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const { name, password } = body;

      if (!EMAIL_RE.test(email)) return json(400, { error: "invalid email" });
      const problems = validatePasswordStrength(password, email);
      if (problems.length) return json(400, { error: "weak password", requirements: problems });

      if (await findOwnerByEmail(email)) return json(409, { error: "email already registered" });

      const ownerId = crypto.randomUUID();
      const owner = {
        id: ownerId,
        ownerId,
        name: name || null,
        email,
        passwordHash: await hashPassword(password),
        pushSubscriptions: [],
        createdAt: new Date().toISOString(),
      };
      await cosmos.owners.items.create(owner);

      const token = await signSession(ownerId);
      return json(201, { token, ownerId, name: owner.name, email });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
