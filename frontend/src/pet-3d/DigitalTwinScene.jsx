import { Component, Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import DogModel from "./DogModel.jsx";
import Icon from "./Icon.jsx";
import ActionProps from "./ActionProps.jsx";
import { ACTION_LABELS } from "./dogConfig.js";

class SceneBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-fallback">
        <Icon name="cube" size={36} />
        <h3>3D viewer unavailable</h3>
        <p>
          Enable WebGL in your browser to view the dog. Sensor controls remain
          available.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function CameraControls({ controls }) {
  useEffect(() => {
    controls.current?.saveState();
  }, [controls]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0.95, 0]}
      minDistance={3.3}
      maxDistance={10}
      maxPolarAngle={Math.PI / 2 - 0.025}
      enablePan={false}
    />
  );
}

export default function DigitalTwinScene({
  activity,
  orientation,
  playing,
  modelUrl,
  modelConfig,
  connected,
  revision,
  onComplete,
  onModelInfo,
  headAction,
  className = "",
  style,
}) {
  const controls = useRef();
  const [modelStatus, setModelStatus] = useState("Loading rigged dog…");
  return (
    <section className={`pet-3d viewer card ${className}`} style={style} aria-label="Interactive 3D dog viewer">
      <div className="viewer-top">
        <span className="small-label">
          <Icon name="cube" /> LIVE VISUALIZATION
        </span>
        <span className="viewer-tag">{modelStatus}</span>
      </div>
      <SceneBoundary>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [4.1, 2.8, 4.6], fov: 36 }}
          fallback={
            <div className="scene-fallback">
              WebGL is unavailable. Sensor simulation is still usable.
            </div>
          }
        >
          <color attach="background" args={["#edf0eb"]} />
          <fog attach="fog" args={["#edf0eb", 10, 22]} />
          <ambientLight intensity={1.2} />
          <hemisphereLight args={["#ffffff", "#b6bb9e", 1.4]} />
          <directionalLight
            castShadow
            position={[4, 7, 4]}
            intensity={3}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
            shadow-normalBias={0.035}
          />
          <Suspense fallback={null}>
            <DogModel
              activity={activity}
              orientation={orientation}
              playing={playing}
              modelUrl={modelUrl}
              modelConfig={modelConfig}
              onModelStatus={setModelStatus}
              onModelInfo={onModelInfo}
              revision={revision}
              onComplete={onComplete}
            />
            <ActionProps activity={activity} />
          </Suspense>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            position={[0, 0.01, 0]}
          >
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#edf0eb" roughness={1} />
          </mesh>
          <gridHelper
            args={[16, 32, "#cfd8cd", "#dfe5dc"]}
            position={[0, 0.015, 0]}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[1.38, 1.395, 96]} />
            <meshBasicMaterial color="#b5c9b9" transparent opacity={0.75} />
          </mesh>
          <CameraControls controls={controls} />
        </Canvas>
      </SceneBoundary>
      <div className="viewer-bottom">
        <span>
          <Icon name="orbit" size={16} /> Drag to orbit <i /> Scroll to zoom
        </span>
        <button
          className="icon-button"
          aria-label="Reset camera"
          title="Reset camera"
          onClick={() => controls.current?.reset()}
        >
          <Icon name="reset" size={17} />
        </button>
      </div>
      <div className="collar-note">
        <span className={`status-dot ${connected ? "" : "muted"}`} />{" "}
        {connected
          ? `${ACTION_LABELS[activity] || activity}${headAction ? ` · ${ACTION_LABELS[headAction]}` : ""} · neck sensor active`
          : "Sensor disconnected"}
      </div>
    </section>
  );
}
