const { app } = require("@azure/functions");
const cosmos = require("../lib/cosmos");
const { verifyPassword, signSession } = require("../lib/auth");
const { json, errorResponse } = require("../lib/respond");

async function findOwnerByEmail(email) {
  const { resources } = await cosmos.owners.items
    .query({
      query: "SELECT * FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: email.toLowerCase() }],
    })
    .fetchAll();
  return resources[0];
}

app.http("authLogin", {
  route: "auth/login",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const owner = await findOwnerByEmail(email);
      // Same generic error whether the email doesn't exist or the password is wrong —
      // don't let login responses leak which emails are registered.
      if (!owner || !(await verifyPassword(body.password || "", owner.passwordHash))) {
        return json(401, { error: "invalid email or password" });
      }
      const token = await signSession(owner.ownerId);
      return json(200, { token, ownerId: owner.ownerId, name: owner.name, email: owner.email });
    } catch (err) {
      return errorResponse(err, context);
    }
  },
});
