# Pet 3D dependency map (inspection before extraction)

```text
Demo page → components/PetDigitalTwin/PetDigitalTwin.jsx (demo orchestrator)
  ├─ DemoSensorService / WebSocketSensorService → usePetSensor
  ├─ useActivityDetection → activityDetection → DETECTION + smoothing
  ├─ useSensorCalibration → orientation → ORIENTATION + smoothing
  ├─ DigitalTwinScene → Canvas + OrbitControls + ActionProps + Icon
  │   └─ DogModel → useGLTF + SkeletonUtils.clone + dogConfig + dogRig
  │       └─ useDogAnimations → DogAnimationController
  │           ├─ AnimationMixer + quaternion transforms (Three.js)
  │           ├─ proceduralDogActions
  │           └─ orientation + smoothing + dogRig + config
  └─ SensorPanel / SimulationControls / CalibrationControls /
     RecordingControls / ModelDebugPanel (demo UI)
```

## Extraction decisions

Move the existing scene, model, action props, icons, animation hook/controller,
rig config/inspection, orientation/calibration, smoothing, activity detector,
and their constants into `src/pet-3d`. Preserve animation math and the GLB.
Keep old import paths as small compatibility exports for demo/tests.
Extract only viewer styles; consumers must not need the demo stylesheet.

Add a public prop-driven `PetDigitalTwin`, a strict flat/nested sensor adapter,
and transport examples outside the core import graph. The demo will pass its
existing samples, calibrated orientation, activity commands and completion
callback through that public component.

Calibration currently subtracts captured pitch/roll offsets. Smoothing occurs
in the animation controller. Orientation is supplied in each sample; there is
no accelerometer/gyroscope fusion algorithm. Raw-only inputs will leave head
orientation neutral and remain usable for optional activity classification.

## Excluded from the integration copy

`src/pages/PetDigitalTwinDemo.jsx`, `src/main.jsx`, `src/styles.css`, the demo
orchestrator and its CSS, telemetry/control/debug/recording components,
`src/services/*`, `usePetSensor`, `useRecording`, `useActivityDetection` (demo
hook wrapper), `demoActions`, and `recording`. These stay for local testing.

## External dependencies and assets

React / React DOM 19, Three.js, React Three Fiber 9, Drei 10.
`public/models/dog/dog.glb` is the unchanged Quaternius Shiba Inu; its six
materials are embedded. Preserve `src/assets/3d/ATTRIBUTION.md` and the rig
manifest for provenance. No remote texture or demo generator is required.

## Git inspection

At inspection, `git status` reports that this directory is not a Git repository.
No commit, staging, or repository initialization is part of this extraction.
