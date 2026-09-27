const cosmos = require("./cosmos");

// SYSTEM_DESIGN §8: "every bandhan-fn-api call is scoped server-side to the logged-in
// owner's own dogId, not just hidden in the UI" — this is the one place that check lives.
async function requireOwnedDog(dogId, ownerId) {
  let dog;
  try {
    ({ resource: dog } = await cosmos.dogs.item(dogId, dogId).read());
  } catch (err) {
    if (err.code === 404) dog = undefined;
    else throw err;
  }
  if (!dog || dog.ownerId !== ownerId) {
    const err = new Error("dog not found");
    err.statusCode = 404;
    throw err;
  }
  return dog;
}

module.exports = { requireOwnedDog };
