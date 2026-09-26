# Bandhan (PetPulse)

A collar that watches how a dog moves and sounds while its owner is away, learns what's normal for that specific dog, and alerts the owner the moment something looks like physical or emotional distress.

This repo is early. The **PRD and system design are locked**; the website and firmware are not written yet.

Team: **Origami Treats**

## Start here

| File | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Locked scope, goals, hardware BOM, functional requirements, edge cases, decisions already made |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Azure architecture, data model, API surface, data flow, security, known simplifications |

## Idea in one breath

Two MPU6050 units (accelerometer + gyroscope) and a condenser mic on the collar read a dog's motion and vocal pattern continuously. An on-device classifier compares that against the dog's own learned baseline — not a generic threshold — and beeps immediately (short = minor anomaly, long = distress) whenever it looks like a seizure, limping, prolonged stillness, or a distress cry. No raw audio ever leaves the collar; the mic is pattern-analysis only. The owner sees all of this on a website, not a native app, and can also send the dog a beep cue ("sit" / "come to owner") and see, via the same two IMUs, whether the dog's posture matched — the reward signal for a reinforcement-learning loop that improves the response over time.

## Status

- [x] Idea, research, problem statement
- [x] PRD (v1) + system design
- [ ] Firmware — sensor loop, on-device classifier, beep logic
- [ ] Azure backend — IoT Hub, fusion function, Cosmos DB, website API
- [ ] Website — dashboard, event feed, command controls
- [ ] Pilot — first real collar on a first real dog

## Stack (planned)

- **Collar firmware:** ESP32, dual MPU6050, condenser mic, buzzer + LED — TinyML on-device classifier.
- **Cloud:** Azure IoT Hub (ingestion + device commands), Azure Functions (fusion + API), Cosmos DB (events/baselines), Web PubSub (live updates), Static Web Apps (website hosting) — see [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for exact resource names and why each was chosen.
- **Website:** React/Next.js — dashboard, activity/vocal trend charts, event feed, sensitivity settings, command-cue controls.

## Local

App commands will land here once the website and firmware are scaffolded.
