# Bandhan (PetPulse)

A collar wearable that watches a dog's motion and vocal patterns while its owner is away, and pushes an alert the moment something looks like physical or emotional distress — plus a lightweight beep-cue channel so the owner can send a trained command and see whether the dog responded.

Team: **Origami Treats**

## What's here
- [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) — architecture, Azure services, API surface, edge cases, sequence diagrams.
- Product requirements (PRD) live in the team's PetPulse doc — link it here once shared with the repo.

## Stack (planned)
- **Collar firmware:** ESP32, dual MPU6050 (accel + gyro), condenser mic, buzzer + LED — TinyML on-device classifier.
- **Cloud:** Azure IoT Hub (ingestion + device commands), Azure Functions (fusion logic), Cosmos DB (events/baselines), Web PubSub (live updates), Static Web Apps (dashboard hosting).
- **Website:** React/Next.js dashboard — activity feed, trend charts, sensitivity settings, command-cue controls.

## Status
Early build — system design in progress, firmware and website not yet scaffolded.
