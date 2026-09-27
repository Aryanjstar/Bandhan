// Independent verification entry: no demo service, demo stylesheet, or app shell.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PetDigitalTwin, normalizePetSensorFrame } from "../index.js";
import BackendSensorExample from "./BackendSensorExample.jsx";
import WebSocketSensorExample from "./WebSocketSensorExample.jsx";
import ExternalDataExample from "./ExternalDataExample.jsx";

function IntegrationCheck() {
  const pet = useRef();
  const [mode, setMode] = useState("direct");
  const [activity, setActivity] = useState("idle");
  const [revision, setRevision] = useState(0);
  const [sensorData, setSensorData] = useState(() => normalizePetSensorFrame({ ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, pitch: 0, roll: 0 }));
  const [report, setReport] = useState("");
  const send = (pitch, roll) => setSensorData(normalizePetSensorFrame({ ax: 0.14, ay: -0.08, az: 9.73, gx: 1.8, gy: -4.1, gz: 13.6, pitch, roll }));
  return <main>
    <h1>Pet 3D integration verification</h1>
    <select aria-label="Example" value={mode} onChange={e => setMode(e.target.value)}>
      <option value="direct">Direct props</option><option value="xyz">Six XYZ values</option>
      <option value="rest">REST</option><option value="socket">WebSocket</option>
    </select>
    {mode === "direct" ? <>
      <button onClick={() => send(30, 0)}>Pitch 30</button>
      <button onClick={() => send(0, 28)}>Roll 28</button>
      <button onClick={() => setSensorData(normalizePetSensorFrame({ accel: {x:0,y:0,z:9.81}, gyro: {x:0,y:0,z:0} }))}>Raw only</button>
      <button onClick={() => pet.current.calibrate()}>Calibrate</button>
      <button onClick={() => pet.current.resetCalibration()}>Reset calibration</button>
      <button onClick={() => setReport(JSON.stringify(pet.current.getState()))}>Inspect state</button>
      {['idle','walk','run','jump','eat','drink','sniff'].map(a => <button key={a} onClick={() => { setActivity(a); setRevision(n=>n+1); }}>{a}</button>)}
      <output aria-label="Viewer state">{report}</output>
      <PetDigitalTwin ref={pet} sensorData={sensorData} activity={activity} revision={revision} staleAfterMs={0} />
    </> : mode === "rest" ? <BackendSensorExample /> : mode === "socket" ? <WebSocketSensorExample /> : <ExternalDataExample pitch={12} roll={-4} />}
  </main>;
}
createRoot(document.getElementById("root")).render(<IntegrationCheck />);
