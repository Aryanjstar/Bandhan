import { useEffect, useState } from "react";
import { PetDigitalTwin, normalizePetSensorFrame } from "../index.js";

export default function WebSocketSensorExample({ url = "ws://localhost:8080/pet/sensor" }) {
  const [sensorData, setSensorData] = useState();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const socket = new WebSocket(url);
    setSensorData(undefined);
    setConnected(false);
    setError("");
    socket.onopen = () => { if (active) setConnected(true); };
    socket.onmessage = event => {
      if (!active) return;
      try { setSensorData(normalizePetSensorFrame(JSON.parse(event.data))); setError(""); }
      catch (err) { setError(err.message); }
    };
    socket.onerror = () => { if (active) setError("Sensor socket failed"); };
    socket.onclose = () => { if (active) setConnected(false); };
    return () => { active = false; socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close(); };
  }, [url]);
  return <>
    {error && <p role="status">{error}</p>}
    <PetDigitalTwin key={url} sensorData={sensorData} playing={connected} />
  </>;
}
