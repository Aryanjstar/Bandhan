# Pawse backend

Two independently deployed services, matching [docs/SYSTEM_DESIGN.md](../docs/SYSTEM_DESIGN.md) exactly — this is the microservices boundary for this build: one event-driven ingestion/fusion service, one request-driven API service. Splitting further (e.g. a separate auth service) isn't justified at this scale and isn't in the locked design.

> The project renamed from PetPulse/Bandhan to Pawse after these Azure resources were provisioned. `bandhan-fn-fusion`, `bandhan-fn-api`, `rg-bandhan-dev`, etc. are the real, live resource names — not a leftover typo. Renaming them means recreating each resource, so that's deferred to a separate decision.

| Service | Deploys to | Trigger | Owns |
|---|---|---|---|
| [fusion-service/](fusion-service) | `bandhan-fn-fusion` | IoT Hub built-in Event Hub-compatible endpoint | Motion+vocal fusion scoring, baseline cold-start gating, alert cooldown, Cosmos DB writes, Web PubSub + Web Push fan-out, command-loop match/no-match/approximate-match scoring |
| [api-service/](api-service) | `bandhan-fn-api` | HTTP + 1-minute timer | Owner signup/login (JWT), dog/device CRUD, event feed + feedback, settings → device twin, command send, command-session timeout sweep, Web PubSub negotiate, push subscription registration |

Both are Node.js 24 Azure Functions (v4 programming model), Consumption plan, system-assigned managed identity. Neither service holds a connection string in its own code — Cosmos DB access is AAD/RBAC via `DefaultAzureCredential`, and the IoT Hub/Web PubSub/JWT/VAPID secrets are Key Vault references (`@Microsoft.KeyVault(...)`) resolved by the platform using that same identity (SYSTEM_DESIGN §8).

## Local development

Each service needs the [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) and an `az login` session (local `DefaultAzureCredential` resolution falls back to the Azure CLI credential):

```bash
cd backend/fusion-service && npm install && npm start
cd backend/api-service && npm install && npm start
```

`local.settings.json` in each service points at the real `rg-bandhan-dev` Cosmos DB/Key Vault — there's no local emulator for this pilot, so local runs read/write real (dev-tier) cloud data.

## Deploy

```bash
cd backend/fusion-service && npm install --omit=dev && func azure functionapp publish bandhan-fn-fusion
cd backend/api-service && npm install --omit=dev && func azure functionapp publish bandhan-fn-api
```

## Auth model

Owner auth is email + password (bcrypt, strong-password policy enforced server-side in `api-service/src/lib/auth.js`) issuing a 7-day JWT, not Azure Static Web Apps' built-in provider auth — that was the original SYSTEM_DESIGN §8 plan, but there's no dedicated Google Cloud project to register an OAuth client under yet, and PRD §15 doesn't mandate a specific provider. Every protected route resolves `ownerId` from the JWT server-side and checks it against `dog.ownerId` (`lib/ownership.js`) — never trusts a client-supplied id. Revisit Google/GitHub OAuth once the website exists and a GCP project is designated for it.
