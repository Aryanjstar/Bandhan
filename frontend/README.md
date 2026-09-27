# Pawse frontend

The dog-profile onboarding flow, built from the Figma design. React + Vite + Tailwind v4, one `src/App.tsx` state machine over the 17 screens (matches the Figma Make export's structure — kept as one file rather than split, since that's how it shipped).

Only the onboarding exists here. The dashboard (event feed, activity/vocal trend charts, sensitivity settings, command-cue controls) described in [docs/PRD.md](../docs/PRD.md) §7 isn't built yet.

## Run it

```bash
npm install
npm run dev   # http://localhost:5173
```

For the onboarding's final step to actually save a dog, [backend/api-service](../backend/api-service) needs to be running too — see [backend/README.md](../backend/README.md). Without it, the flow still works end-to-end visually; the save just fails with an inline error on the Record screen and nothing is lost (fixing the connection and clicking Next again retries).

## What's here vs. what the Figma design showed

- **Screen order fixed.** The Figma Make export's `ORDER` array didn't match the actual Figma screens — it ran `energy → vocal → whimper → bark-triggers → record → temperament → alone-time → fears → congrats`, but the design goes `energy → temperament → alone-time → fears → vocal → whimper → bark-triggers → record → congrats`. Fixed in `App.tsx`.
- **Opening video intro added.** `Intro` (in `App.tsx`) plays `public/video/pawse-opening.mp4` once full-bleed, dims to black on end (or on error/after a 6s safety timeout, so a failed video never strands the user), then hands off to the existing Splash → Paw → onboarding sequence.
- **Responsive stage.** The Figma design is a fixed 390×844 canvas. `useStageScale` computes a uniform (non-distorting) scale-to-fit and centers it on a dark backdrop, so it works on any phone or desktop viewport without stretching the vector art or cropping content.
- **No login/signup screen exists in the Figma design**, but the backend requires an owner account before it'll save a dog (PRD §7 only describes a later "Account" page). `src/lib/api.ts`'s `ensureOwner()` transparently provisions and caches (in `localStorage`) one guest owner account per browser on load — no UI for it, matching the design as shown.
- **Extended `dogs.js`.** The onboarding collects far more than the original `POST /dogs` handler stored (just name/breed/age/temperament). All of it — sex, neutered, ownedSince, energyLevel, vocalLevel, whimperFrequency, barkTriggers, aloneTimeBehavior/Detail, fears — is now persisted as `dogs` profile metadata (not fed into the learned baseline; PRD §6 is explicit that profile fields only seed default thresholds).

## Config

`VITE_API_BASE_URL` (see `.env.example`) — defaults to `http://localhost:7071/api` if unset.
