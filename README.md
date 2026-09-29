# Pawse

Problem Statement: Created the project for when owner leaves the house or leaves the dog with someone else, the dog's day becomes a black box the owner has no way to know whether the dog is calm, anxious, in pain, or in genuine danger until they physically return.
([PDF](https://drive.google.com/file/d/1zcKOLbtUy1UHtV7eVkzTtOo5BbHh0dMh/view?usp=sharing)): Link to our full-fledged story and project description

A collar that watches how a dog moves and sounds while its owner is away, learns what's normal for that specific dog, and alerts the owner the moment something looks like physical or emotional distress.

This repo is early. The **PRD and system design are locked**; the onboarding flow of the website exists (`frontend/`), the dashboard and firmware are not written yet.

Team: **Origami Treats**

> Renamed from PetPulse/Bandhan to **Pawse**. The live Azure resources (`rg-bandhan-dev` and everything in it) were provisioned before the rename and still use the `bandhan-*` prefix — migrating those to `pawse-*` names means recreating several of them (Cosmos DB, IoT Hub, Function Apps don't support in-place rename), so that's a deliberate follow-up decision, not done here.

## Start here

| File | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Locked scope, goals, hardware BOM, functional requirements, edge cases, decisions already made |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Azure architecture, data model, API surface, data flow, security, known simplifications |
| [frontend/README-PET-3D.md](frontend/README-PET-3D.md) | Reusable React 3D dog viewer, sensor payload contract, integration examples |

## Idea in one breath

Two MPU6050 units (accelerometer + gyroscope) and a condenser mic on the collar read a dog's motion and vocal pattern continuously. An on-device classifier compares that against the dog's own learned baseline — not a generic threshold — and beeps immediately (short = minor anomaly, long = distress) whenever it looks like a seizure, limping, prolonged stillness, or a distress cry. No raw audio ever leaves the collar; the mic is pattern-analysis only. The owner sees all of this on a website, not a native app, and can also send the dog a beep cue ("sit" / "come to owner") and see, via the same two IMUs, whether the dog's posture matched — the reward signal for a reinforcement-learning loop that improves the response over time.

## Status

- [x] Idea, research, problem statement
- [x] PRD (v1) + system design
- [ ] Firmware — sensor loop, on-device classifier, beep logic
- [x] Azure backend — IoT Hub, fusion function, Cosmos DB, website API (`rg-bandhan-dev`, `centralindia`, pre-rename names — see note above) — see [backend/README.md](backend/README.md)
- [x] Website onboarding — dog profile intake flow (`frontend/`, see [frontend/README.md](frontend/README.md))
- [ ] Website dashboard — event feed, command controls, sensitivity settings
- [ ] Pilot — first real collar on a first real dog

## Stack (planned)

- **Collar firmware:** ESP32, dual MPU6050, condenser mic, buzzer + LED — TinyML on-device classifier.
- **Cloud:** Azure IoT Hub (ingestion + device commands), Azure Functions (fusion + API), Cosmos DB (events/baselines), Web PubSub (live updates), Static Web Apps (website hosting) — see [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for exact resource names and why each was chosen.
- **Website:** React + Vite + Tailwind (`frontend/`) — onboarding is built; dashboard (activity/vocal trend charts, event feed, sensitivity settings, command-cue controls) is not.

## Local

```bash
# Backend (needs Azure Functions Core Tools v4 + az login — see backend/README.md)
cd backend/api-service && npm install && npm start      # binds :7071

# Frontend
cd frontend && npm install && npm run dev                # http://localhost:5173
```

The frontend's onboarding flow calls the real api-service/Cosmos DB locally (see [frontend/README.md](frontend/README.md) for how it bootstraps an owner without a login screen).
