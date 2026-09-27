# Pet 3D integration handoff

This feature renders the existing rigged Quaternius Shiba Inu, applies supplied
neck/head orientation, and plays activity animations. Sensor transport belongs
to the parent application. The reusable viewer has no dependency on the demo
sensor generator, sliders, telemetry, recording, or demo page.

The demo at `/pet-digital-twin-demo` uses this same public component. Model,
lighting, camera, animation mathematics, and the dog material palette are
preserved. `PET-3D-DEPENDENCIES.md` records the inspection and extraction map.

## Architecture

```text
ESP32 / Backend / WebSocket / API
              ↓
        Sensor Payload
              ↓
     normalizePetSensorFrame()
              ↓
       PetDigitalTwin
              ↓
         3D Dog Model
```

The parent owns connections, authentication, polling, reconnection and errors.
The adapter validates packets and normalizes units. The component owns local
calibration, optional activity classification and rendering. The renderer uses
the existing animation controller and rig configuration; consumers never need
to access Three.js bones or AnimationMixer.

## Installation

The tested stack is React 19 / React DOM 19, Fiber 9, Drei 10, Three 0.180.
In an existing **React 19** application install:

```sh
npm install three@^0.180.0 @react-three/fiber@^9.3.0 @react-three/drei@^10.7.7
```

If React is not already installed:

```sh
npm install react@^19.1.1 react-dom@^19.1.1
```

Do not install React twice in the same application. This extraction is verified
with the repository's React 19 dependency set; React 18 compatibility has not
been validated. A JSX/CSS-capable bundler and browser WebGL are required. For an
SSR framework, mount the viewer in a client-only component (disable SSR for it).
No Vite-specific runtime API is required; optional development logging checks
`import.meta.env?.DEV`. There is no network font requirement; DM Sans is used if
provided by the host, otherwise sans-serif. The demo still supplies its fonts.

## Files to copy

Copy **all of `src/pet-3d` except `examples/`**, plus the GLB and attribution below.
No old compatibility export under `src/components`, `src/hooks` or `src/utils`
is required. The public index imports its own scoped viewer CSS automatically.

| File (relative to repository root) | Purpose | Required / Optional |
| --- | --- | --- |
| `src/pet-3d/index.js` | Public exports | Required |
| `src/pet-3d/PetDigitalTwin.jsx` | Prop-driven component and ref API | Required |
| `src/pet-3d/DigitalTwinScene.jsx` | Canvas, lights, floor, orbit/reset camera | Required |
| `src/pet-3d/DogModel.jsx` | GLB loading, cloning, material setup, loading/error placeholder | Required |
| `src/pet-3d/ActionProps.jsx` | Existing eating/drinking bowl cues | Required |
| `src/pet-3d/Icon.jsx` | Viewer icons | Required |
| `src/pet-3d/pet-3d.css` | Scoped viewer styles and responsive sizing | Required |
| `src/pet-3d/constants.js` | Existing animation/orientation/detection defaults | Required |
| `src/pet-3d/dogConfig.js` | Model URL, bone and clip mapping | Required |
| `src/pet-3d/adapters/normalizePetSensorFrame.js` | Canonical validation, flat conversion and raw XYZ helper | Required |
| `src/pet-3d/hooks/useSensorFrame.js` | Last accepted frame, bounded history and staleness | Required |
| `src/pet-3d/hooks/useSensorCalibration.js` | Existing pitch/roll tare | Required |
| `src/pet-3d/hooks/useDogAnimations.js` | Existing render-loop animation bridge | Required |
| `src/pet-3d/utils/dogAnimation.js` | Existing mixer, crossfade and sensor transforms | Required |
| `src/pet-3d/utils/dogRig.js` | Rig discovery, held clip sampling, diagnostics | Required |
| `src/pet-3d/utils/proceduralDogActions.js` | Existing procedural action offsets | Required |
| `src/pet-3d/utils/orientation.js` | Tare subtraction, degree/radian conversion and limits | Required |
| `src/pet-3d/utils/smoothing.js` | Frame-rate-independent damping | Required |
| `src/pet-3d/utils/activityDetection.js` | Optional activity classifier (statically imported) | Required |
| `src/pet-3d/types/sensorTypes.js` | JSDoc sensor contract | Required for documented type references |
| `public/models/dog/dog.glb` | Original working model with embedded materials and clips | Required |
| `src/assets/3d/ATTRIBUTION.md` | Model author, source and CC0 provenance | Preserve with handoff |
| `src/assets/3d/dog-manifest.json` | Loaded bone and full clip inventory | Optional diagnostic reference |
| `README-PET-3D.md` | Integration instructions | Preserve with handoff |
| `src/pet-3d/examples/BackendSensorExample.jsx` | REST parent example | Optional |
| `src/pet-3d/examples/WebSocketSensorExample.jsx` | WebSocket parent example | Optional |
| `src/pet-3d/examples/ExternalDataExample.jsx` | Existing React XYZ values | Optional |
| `src/pet-3d/examples/IntegrationCheck.jsx` and `integration.html` | Standalone verification page | Optional |

```text
src/pet-3d/
  index.js
  PetDigitalTwin.jsx
  DigitalTwinScene.jsx
  DogModel.jsx
  ActionProps.jsx
  Icon.jsx
  pet-3d.css
  constants.js
  dogConfig.js
  adapters/normalizePetSensorFrame.js
  hooks/useSensorFrame.js
  hooks/useSensorCalibration.js
  hooks/useDogAnimations.js
  utils/dogAnimation.js
  utils/dogRig.js
  utils/proceduralDogActions.js
  utils/orientation.js
  utils/smoothing.js
  utils/activityDetection.js
  types/sensorTypes.js
  examples/...
```

## Public API

```jsx
import { PetDigitalTwin, normalizePetSensorFrame, createSensorFrame,
  DOG_MODEL_URL, DOG_RIG_CONFIG } from './pet-3d';
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `sensorData` | undefined | Canonical frame (flat payloads also accepted defensively); send a **new object** for each packet |
| `activity` | frame activity, then classification | Explicit body action takes precedence |
| `activityMode` | `"automatic"` | `"automatic"` uses the existing detector only if neither activity prop nor frame activity exists; `"external"` defaults to Idle instead |
| `playing` | true | Pause/resume body clip time; orientation smoothing continues toward supplied angles |
| `staleAfterMs` | 2000 | Pause clip time and show disconnected if packets stop; `0` disables timeout for static data/tests |
| `modelUrl` | `/models/dog/dog.glb` | Serve the unchanged GLB at this URL, or override for a subpath/CDN |
| `modelConfig` | `DOG_RIG_CONFIG` | Advanced rig, transform and orientation settings; pass a stable object |
| `revision` | 0 | Increment to replay the same Jump command |
| `onComplete(revision)` | undefined | Jump completion notification; viewer returns to Idle automatically |
| `onSensorError(error)` | undefined | Invalid `sensorData` notification; previous valid frame is retained |
| `onModelInfo(info)` | undefined | Optional rig/clip diagnostics |
| `headAction` | undefined | Optional status label (`tiltLeft`, `tiltRight`, `lookUp`, `lookDown`, `headShake`); angles must still come from data |
| `connected` | automatic freshness | Advanced status/animation-gating override used by the preserved demo |
| `className`, `style` | empty | Host sizing/styling on the viewer section |
| `ref` | undefined | `calibrate()`, `resetCalibration()`, `getState()` |

Activity precedence is `activity` prop → frame `activity` → detector or Idle.
This preserves live-source automatic detection and explicit demo commands.
There is no transport switch inside the component. Recreate/remount the viewer
(e.g. a `key` per device/session) when changing devices or restarting a device
whose timestamps reset, so its history and calibration do not carry over.

## Canonical sensor schema and units

```js
{
  accel: { x: 0.14, y: -0.08, z: 9.73 }, // required, m/s² including gravity
  gyro: { x: 1.8, y: -4.1, z: 13.6 },   // required, degrees/second
  orientation: { pitch: -7.4, roll: 11.2, yaw: 0 }, // optional, degrees
  timestamp: 238749,                    // milliseconds; generated if omitted
  activity: 'idle'                      // optional
}
```

All six XYZ values are required finite JavaScript numbers, not numeric strings.
If orientation is provided, both pitch and roll are required; yaw is optional
and retained but currently not rendered. Timestamp must be finite and should
increase in a consistent source timebase; Unix milliseconds are recommended.
Device uptime milliseconds also work. Older packets are ignored. Equal-time
packets replace that sample without duplicating activity history, allowing
parent-side corrections while paused. Timestamp `0` is valid.

`normalizePetSensorFrame(payload)` returns a fresh canonical object without
mutating the caller. Missing timestamp becomes `Date.now()` once at ingestion.
Malformed inputs throw `TypeError`; catch this in the parent transport. The
component also validates inputs and retains its last valid frame on error.

For a backend reporting gyro radians/sec, convert once at the adapter boundary:

```js
const frame = normalizePetSensorFrame(payload, { gyroUnit: 'rad/s' });
// Output is now deg/s. Pass it to PetDigitalTwin without converting it again.
```

Acceleration is always m/s². Convert g to m/s² upstream (multiply by 9.81).
Orientation angles always remain degrees, regardless of `gyroUnit`.

### Orientation source of truth

Pitch/roll are **expected from the ESP32 or backend**. No frontend fusion/filter
exists in this prototype. Six raw IMU values alone do not determine drift-free
orientation; the renderer does not pretend otherwise. Without orientation the
head remains neutral. Raw XYZ can still drive optional activity classification.
When angles are available, the existing tare, clamps (pitch ±45°, roll ±35°)
and damping are applied. Yaw is reserved and does not rotate the dog.

## Minimum integration

```jsx
import { PetDigitalTwin } from './pet-3d';

const sensorData = {
  accel: { x: 0, y: 0, z: 9.81 },
  gyro: { x: 0, y: 0, z: 0 },
  orientation: { pitch: 10, roll: -4 },
  timestamp: Date.now(),
};
export default function Page() {
  return <PetDigitalTwin sensorData={sensorData} staleAfterMs={0} />;
}
```

For a live stream leave the default stale timeout enabled. The viewer provides
its own responsive height (365–555px); `style={{ height: 500 }}` overrides it.

## Direct XYZ input

```jsx
import { useMemo } from 'react';
import { PetDigitalTwin, createSensorFrame } from './pet-3d';

export default function CollarView({ ax, ay, az, gx, gy, gz, pitch, roll, timestamp }) {
  const frame = useMemo(() => createSensorFrame({
    ax, ay, az, gx, gy, gz, pitch, roll, timestamp,
  }), [ax, ay, az, gx, gy, gz, pitch, roll, timestamp]);
  return <PetDigitalTwin sensorData={frame} />;
}
```

Omit **both** pitch and roll if they are unavailable; the model still renders.
Separate accelerometer/gyroscope props are intentionally not a second API.
Use `createSensorFrame` (an alias of the normalizer) for the six-value path.

## Flat backend JSON / recommended ESP32 contract

```json
{
  "ax": 0.14,
  "ay": -0.08,
  "az": 9.73,
  "gx": 1.8,
  "gy": -4.1,
  "gz": 13.6,
  "pitch": -7.4,
  "roll": 11.2,
  "timestamp": 238749
}
```

```js
const frame = normalizePetSensorFrame(apiResponse);
// setSensorData(frame), then render <PetDigitalTwin sensorData={sensorData} />
```

ESP32 acceleration must include gravity in m/s², gyro must be deg/s, and fused
pitch/roll must be degrees. Timestamp is source milliseconds. The same JSON
works through Node, Python, MQTT bridges, Firebase, REST or WebSocket; map any
source-specific field names in your parent adapter, never in `DogModel.jsx`.

## REST / fetch example

Complete polling lifecycle is in `examples/BackendSensorExample.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { PetDigitalTwin, normalizePetSensorFrame } from './pet-3d';

export default function RestPet({ endpoint = '/api/pet/sensor' }) {
  const [frame, setFrame] = useState();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = normalizePetSensorFrame(await response.json());
        if (active) { setFrame(next); setError(''); }
      } catch (e) {
        if (active && e.name !== 'AbortError') setError(e.message);
      } finally {
        if (active) timer = setTimeout(poll, 50);
      }
    }
    setFrame(undefined);
    poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [endpoint]);
  return <>
    {error && <p role="status">{error}</p>}
    <PetDigitalTwin key={endpoint} sensorData={frame} />
  </>;
}
```

The parent owns polling. This waits 50ms after each response and never overlaps
requests; it does not guarantee 20Hz when the network is slow. Configure CORS
and authentication in the parent/backend. No real backend is bundled.

## WebSocket example

```jsx
import { useEffect, useState } from 'react';
import { PetDigitalTwin, normalizePetSensorFrame } from './pet-3d';

export default function SocketPet({ url = 'ws://localhost:8080/pet/sensor' }) {
  const [frame, setFrame] = useState();
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const socket = new WebSocket(url);
    setFrame(undefined); setOnline(false);
    socket.onopen = () => { if (active) setOnline(true); };
    socket.onmessage = event => {
      if (!active) return;
      try { setFrame(normalizePetSensorFrame(JSON.parse(event.data))); setError(''); }
      catch (e) { setError(e.message); }
    };
    socket.onerror = () => { if (active) setError('Sensor socket failed'); };
    socket.onclose = () => { if (active) setOnline(false); };
    return () => {
      active = false;
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    };
  }, [url]);
  return <>
    {error && <p role="status">{error}</p>}
    <PetDigitalTwin key={url} sensorData={frame} playing={online} />
  </>;
}
```

Use `wss://` with HTTPS hosting. Implement reconnection/backoff in the parent if
needed. The included example does not auto-reconnect. `playing={online}` pauses
immediately on close; the viewer's disconnected indicator also updates after
the stale timeout. No WebSocket library is required.

## Calibration / tare

Mounting angle introduces a constant pitch/roll bias. Hold the pet/sensor in its
neutral position and call `calibrate()`. It captures the current supplied
pitch/roll and subtracts those values from future frames. It does not change
raw sensor values, gyroscope bias or body animation. Offsets are per viewer,
in memory, and reset on unmount.

```jsx
import { useRef } from 'react';
import { PetDigitalTwin } from './pet-3d';

export default function CalibratedPet({ sensorData }) {
  const pet = useRef(null);
  return <>
    <button onClick={() => pet.current?.calibrate()}>Calibrate</button>
    <button onClick={() => pet.current?.resetCalibration()}>Reset calibration</button>
    <PetDigitalTwin ref={pet} sensorData={sensorData} />
  </>;
}
```

`calibrate()` returns `true` when accepted, `false` when no fresh upstream
orientation is available. `resetCalibration()` clears both offsets.
`getState()` reads `{ calibrated, offsets, orientation, activity, connected }`
after React commits the update. It is a snapshot, not a subscription.
The preserved demo keeps its existing calibration controls and passes corrected
angles into the same core; production consumers use the ref API above.

## Model and animations

Exact asset: `public/models/dog/dog.glb` (851,196 bytes). Default URL:
`/models/dog/dog.glb`. All six color materials are embedded; no external textures.
The GLB binary is unchanged. Source/license provenance is recorded in
`src/assets/3d/ATTRIBUTION.md`: **Quaternius Shiba Inu**, Ultimate Animated Animal
Pack, **CC0 1.0**, distributed through Poly Pizza. Preserve that file.

Source: https://quaternius.com/packs/ultimateanimatedanimals.html
Distribution: https://poly.pizza/m/y4wdQpg767
License: https://creativecommons.org/publicdomain/zero/1.0/

The rig has 46 skin joints and 24 embedded clips. Twelve clip names are:
`Attack`, `Death`, `Eating`, `Gallop`, `Gallop_Jump`, `Idle_HitReact_Left`,
`Idle_HitReact_Right`, `Jump_ToIdle`, `Walk`, `Idle_2_HeadLow`, `Idle_2`, `Idle`.
The other twelve use the `AnimalArmature|` prefix on these names. Not all are
public actions. The optional manifest lists every clip, duration and bone.

The sensor transform is applied to **Neck1**; the chain continues through
Neck2, Neck3, Head. Procedural action offsets also use Head, Neck3 and configured
leg/body bones. Blender-style dots are removed by GLTFLoader in loaded names.
Do not swap in another rig and expect these mappings to work unchanged.

### Supported actions / gestures

| Demo label | Value | Implementation |
| --- | --- | --- |
| Idle | `idle` | Native `Idle` |
| Walk | `walk` | Native `Walk` |
| Run | `run` | Native `Gallop` |
| Jump | `jump` | Native `Jump_ToIdle`, once, then Idle |
| Eat | `eat` | Native `Eating` |
| Drink | `drink` | Existing held Eating pose + procedural neck/head lapping |
| Sniff | `sniff` | Existing held Eating pose + procedural head sweep |
| Head Shake | `headShake` | Sensor-driven roll sequence over a body animation; no native shake clip |
| Head Tilt Left | `tiltLeft` | Upstream negative roll (demo uses −28°) |
| Head Tilt Right | `tiltRight` | Upstream positive roll (demo uses +28°) |
| Look Up | `lookUp` | Upstream positive pitch (demo uses +32°) |
| Look Down | `lookDown` | Upstream negative pitch (demo uses −32°) |

Tilt/look labels are metadata, not body `activity` values: supply the indicated
angles in orientation, optionally set `headAction`, and retain the body action.
Head Shake requires a changing roll sequence; `activity="headShake"` alone
cannot invent sensor motion. The demo generator produces those gestures outside
the reusable core. Legacy hidden internal code remains for compatibility, but
only the actions above are supported by the integration API.

`activity="walk"` or a frame activity always wins over the detector. Automatic
mode preserves the existing 1-second/100-sample bounded window, minimum 10
samples, acceleration RMS thresholds and alternating gz head-shake detection.
It classifies Idle/Walk/Run/Head Shake; it does not infer Eat/Drink/Sniff/Jump.
Jump completes once. Increment `revision` to replay while keeping `activity`
set to `jump`, or switch to another action and back.

## Sensor → 3D mapping and performance

- Pitch → head/neck up/down; roll → left/right tilt.
- Accelerometer XYZ → optional activity/movement features.
- Gyroscope XYZ → optional rotational/head-shake features, especially gz.
- Supplied orientation → tare subtraction → limits → exponential damping →
  model-space neck rotation layered after animation.

A single neck-mounted IMU **does not provide full-body skeletal tracking**.
Body motion comes from activity clips/procedural poses, not reconstructed paws.

Recommended integration targets: sensor sampling 50–100Hz, network updates
around 20Hz, browser rendering around 60FPS where supported. The existing demo
still emits at 30Hz. These are operating targets, not measured guarantees.
Frame-rate-independent damping interpolates toward the latest received angles
between network updates; it is not IMU fusion or motion prediction. Update React
state with a new frame each packet; use timestamp changes even for equal values.
Throttle higher-rate streams upstream. Canvas DPR is capped at 1.75, shadows
are unchanged, and activity history is bounded. Use `playing={false}` to pause
clip time; rendering/orientation smoothing remains active.

## Error handling

| Condition | Behavior / parent responsibility |
| --- | --- |
| `sensorData` undefined at mount | Neutral stationary dog, disconnected status; no generator starts |
| Orientation omitted | Neutral sensor head offset, calibration unavailable |
| Packets stop | Retain last valid pose, freeze clip time and mark disconnected after 2 seconds by default |
| Malformed prop packet | Retain previous valid frame, notify `onSensorError`; malformed packets do not refresh freshness |
| Adapter throws in parent | Catch error, report/log it and keep last good state |
| Older timestamp | Ignore packet; remount on device/session reset |
| Equal timestamp | Replace frame without adding another history sample |
| WebSocket closes | Parent handles connection/retry; example pauses immediately; stale timeout updates status |
| GLB fails/404 | Existing procedural placeholder and `Asset unavailable` status; sensor controls in the parent can continue |
| WebGL unavailable | Viewer fallback message instead of a broken application |
| Invalid activity prop | Idle fallback; invalid packet activity is rejected by adapter |

A `modelUrl` change resets the model loading boundary. Repeatedly retrying the
same cached failing URL may require remount/cache handling in the host.

## Do not copy demo files

Do not copy `src/pages/PetDigitalTwinDemo.jsx`, `src/main.jsx`, `src/styles.css`,
`src/components/PetDigitalTwin/PetDigitalTwin.jsx` (the demo orchestrator), its
`PetDigitalTwin.css`, or `SimulationControls.jsx`, `SensorPanel.jsx`,
`ActivityPanel.jsx`, `CalibrationControls.jsx`, `RecordingControls.jsx`,
`ModelDebugPanel.jsx`. Also exclude `src/services/DemoSensorService.js`,
`src/services/WebSocketSensorService.js` (a stub), `src/hooks/usePetSensor.js`,
`src/hooks/useRecording.js`, `src/hooks/useActivityDetection.js`,
`src/utils/demoActions.js`, and `src/utils/recording.js`.
Old scene/model/animation/calibration paths are compatibility re-exports and
are not needed when copying the complete pet-3d folder. Vite config, demo HTML,
scripts, tests, build output and node_modules are not integration dependencies.

## Troubleshooting

| Problem | Check / solution |
| --- | --- |
| Dog visible, head doesn't move | Supply both pitch and roll in degrees, fresh timestamps and a new object. Raw XYZ alone intentionally supplies no orientation. |
| Dog rotated incorrectly | Use the original GLB and default rig transforms. Map the IMU axes to the documented model frame upstream. |
| Pitch reversed | Reverse upstream pitch or pass stable `modelConfig={{...DOG_RIG_CONFIG, orientation:{...DOG_RIG_CONFIG.orientation,pitchSign:1}}}`. |
| Roll reversed | Same approach with roll or `rollSign:1`. |
| GLB 404 | Check host public path and network request; override `modelUrl` for a deployment prefix. |
| Animations missing | Confirm bundled GLB and exact clip names; inspect `onModelInfo`. A custom model needs an explicit rig/clip mapping. |
| Canvas zero height | Include the imported CSS; inspect parent display/width and host CSS overrides; set explicit pixel height if needed. |
| WebSocket works but UI doesn't update | Parse JSON, normalize, call state setter with a fresh object; check increasing timestamps, stale timeout, CORS and mixed-content restrictions. |
| Calibration incorrect | Reset, hold neutral and calibrate with fresh supplied orientation; do not apply tare both upstream and locally unintentionally. |
| Auto activity unexpected | Detector thresholds assume m/s² and deg/s. Set external mode/activity if backend classification is authoritative. |
| Long-lived frame stops animating | Default stale timeout is 2s. Send new packets, or use `staleAfterMs={0}` deliberately for static previews. |

## Git and validation

`.gitignore` excludes only standard dependency/build/cache/editor/env artifacts
and test-results. `src/`, `public/`, lockfiles, docs and the GLB are not ignored.
`.env.example` is explicitly allowed. No global `*.glb` ignore is used.
This supplied directory has **no .git repository**: status/diff/tracked-file
checks cannot truthfully report tracked assets. No repository was initialized,
files staged, or commit created. Add the integration files to the destination
application's Git repository using its usual review workflow.

Run `npm test` and `npm run build`. The integration tests load the real GLB and
exercise normalized flat/nested frames, pitch, roll, tare/reset, activity and
module isolation without any DemoSensorService. Existing animation/sensor tests
still run against compatibility exports. For browser verification run
`npm run dev` and visit `/src/pet-3d/examples/integration.html`; it imports no demo
service or CSS. Its REST and WebSocket modes require your own endpoints.
The original demo remains at `/pet-digital-twin-demo`.

## Integration checklist

- [ ] Compatible dependencies installed
- [ ] Complete pet-3d folder copied (examples optional)
- [ ] dog.glb copied and correct URL confirmed
- [ ] Attribution preserved
- [ ] Sensor data normalized and connected
- [ ] Pitch tested in the installed collar axis convention
- [ ] Roll tested
- [ ] Calibration and reset tested
- [ ] External or automatic activity selected and tested
- [ ] Missing orientation, malformed packets and stale connection tested
- [ ] Production build passes
