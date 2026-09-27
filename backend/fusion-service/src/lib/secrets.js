const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const credential = new DefaultAzureCredential();
const client = new SecretClient(process.env.KEY_VAULT_URL, credential);

const cache = new Map();

async function getSecret(name) {
  if (cache.has(name)) return cache.get(name);
  const secret = await client.getSecret(name);
  cache.set(name, secret.value);
  return secret.value;
}

module.exports = { getSecret };
