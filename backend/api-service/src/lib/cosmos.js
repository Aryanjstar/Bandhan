const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(process.env.COSMOS_DATABASE || "bandhan");

module.exports = {
  dogs: database.container("dogs"),
  devices: database.container("devices"),
  owners: database.container("owners"),
  events: database.container("events"),
  baselines: database.container("baselines"),
  commandSessions: database.container("commandSessions"),
};
