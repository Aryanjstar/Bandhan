import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useDogAnimations } from "./hooks/useDogAnimations.js";
import { createPlaceholderClips } from "./utils/dogAnimation.js";
import { ANIMATION } from "./constants.js";
import { DOG_MODEL_URL, DOG_RIG_CONFIG } from "./dogConfig.js";
import { inspectDog } from "./utils/dogRig.js";

function Shape({ position, scale, color = "#ca915b", rotation }) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial color={color} roughness={0.88} />
    </mesh>
  );
}

function Leg({ name, position }) {
  return (
    <group name={name} position={position}>
      <Shape position={[0, -0.22, 0]} scale={[0.14, 0.32, 0.17]} />
      <Shape
        position={[0, -0.49, 0.045]}
        scale={[0.11, 0.24, 0.115]}
        color="#e1b17c"
      />
      <Shape
        position={[0, -0.66, 0.11]}
        scale={[0.15, 0.1, 0.21]}
        color="#f4e3c7"
      />
    </group>
  );
}

export function PlaceholderDog(props) {
  const root = useRef();
  const clips = useMemo(createPlaceholderClips, []);
  useDogAnimations(
    root,
    clips,
    props.activity,
    props.orientation,
    props.playing,
    ANIMATION,
    props.revision,
    props.onComplete,
  );
  return (
    <group ref={root}>
      <group name="Body" position={[0, 0.94, 0]}>
        <Shape scale={[0.4, 0.43, 0.82]} />
        <Shape
          position={[0, -0.09, 0.43]}
          scale={[0.34, 0.37, 0.34]}
          color="#f4e3c7"
        />
        <Leg name="FrontLeft" position={[0.28, -0.13, 0.51]} />
        <Leg name="FrontRight" position={[-0.28, -0.13, 0.51]} />
        <Leg name="BackLeft" position={[0.29, -0.13, -0.51]} />
        <Leg name="BackRight" position={[-0.29, -0.13, -0.51]} />
        <group name="Tail" position={[0, 0.12, -0.7]} rotation={[-0.65, 0, 0]}>
          <Shape position={[0, 0.25, -0.15]} scale={[0.14, 0.38, 0.15]} />
          <Shape
            position={[0, 0.52, -0.08]}
            scale={[0.14, 0.18, 0.2]}
            color="#f4e3c7"
          />
        </group>
        <group name="Neck" position={[0, 0.24, 0.53]}>
          <Shape scale={[0.29, 0.34, 0.3]} />
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0.09, 0.03]}
            castShadow
          >
            <torusGeometry args={[0.287, 0.052, 10, 36]} />
            <meshStandardMaterial color="#286b59" />
          </mesh>
          <mesh position={[0.24, 0.1, 0.19]} rotation={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.1, 0.14, 0.11]} />
            <meshStandardMaterial color="#173c33" />
          </mesh>
          <Shape
            position={[0.277, 0.12, 0.243]}
            scale={[0.018, 0.018, 0.018]}
            color="#aaffce"
          />
          <group name="Head" position={[0, 0.29, 0.13]}>
            <Shape position={[0, 0.13, 0.03]} scale={[0.35, 0.34, 0.35]} />
            <Shape
              position={[0, -0.01, 0.27]}
              scale={[0.28, 0.2, 0.27]}
              color="#f6e7d1"
            />
            <Shape
              position={[0, 0.07, 0.48]}
              scale={[0.105, 0.072, 0.068]}
              color="#302d2a"
            />
            {[-1, 1].map((side) => (
              <group key={side}>
                <Shape
                  position={[side * 0.2, 0.21, 0.293]}
                  scale={[0.041, 0.052, 0.027]}
                  color="#292924"
                />
                <Shape
                  position={[side * 0.2 + 0.01, 0.226, 0.313]}
                  scale={[0.011, 0.014, 0.008]}
                  color="white"
                />
                <mesh
                  position={[side * 0.245, 0.45, 0.005]}
                  rotation={[0.04, 0, side * -0.2]}
                  castShadow
                >
                  <coneGeometry args={[0.17, 0.36, 4]} />
                  <meshStandardMaterial color="#c18a53" roughness={0.9} />
                </mesh>
                <mesh
                  position={[side * 0.245, 0.44, 0.098]}
                  rotation={[0.04, 0, side * -0.2]}
                >
                  <coneGeometry args={[0.095, 0.23, 3]} />
                  <meshStandardMaterial color="#82644f" />
                </mesh>
              </group>
            ))}
            <Shape
              position={[0, -0.115, 0.38]}
              scale={[0.13, 0.018, 0.06]}
              color="#584236"
            />
          </group>
        </group>
      </group>
    </group>
  );
}

function GLTFDog({
  modelUrl,
  modelConfig = DOG_RIG_CONFIG,
  onModelStatus,
  onModelInfo,
  ...props
}) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => {
    const instance = clone(gltf.scene);
    instance.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Preserve the author's palette, with fur-appropriate nonmetallic shading.
        const tune = (material) => {
          const copy = material.clone();
          copy.metalness = 0;
          copy.roughness = 0.86;
          return copy;
        };
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(tune)
          : tune(obj.material);
        obj.frustumCulled = false;
      }
    });
    return instance;
  }, [gltf.scene]);
  const root = useRef();
  useDogAnimations(
    root,
    gltf.animations,
    props.activity,
    props.orientation,
    props.playing,
    modelConfig,
    props.revision,
    props.onComplete,
  );
  useEffect(() => {
    const info = inspectDog(scene, gltf.animations, modelConfig);
    onModelInfo?.(info);
    onModelStatus(
      info.warnings.length
        ? "Rig loaded · check model diagnostics"
        : "Rigged Shiba Inu · Quaternius",
    );
    if (import.meta.env?.DEV) {
      console.info("DOG ANIMATION CAPABILITIES");
      console.table(info.capabilities);
      console.info("DOG NATIVE CLIPS");
      console.table(info.clips);
      console.info("DOG BONE HIERARCHY");
      console.table(info.bones);
    }
  }, [scene, gltf.animations, modelConfig, onModelStatus, onModelInfo]);
  // Parent callbacks can change independently of the owned scene resources.
  useEffect(() => {
    return () => {
      const materials = new Set();
      const skeletons = new Set();
      scene.traverse((obj) => {
        if (obj.isMesh)
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(
            (m) => materials.add(m),
          );
        if (obj.skeleton) skeletons.add(obj.skeleton);
      });
      materials.forEach((material) => material.dispose());
      skeletons.forEach((skeleton) => skeleton.dispose());
    };
  }, [scene]);
  return (
    <group
      scale={modelConfig.scale || 1}
      rotation={modelConfig.rotation || [0, 0, 0]}
      position={modelConfig.position || [0, 0, 0]}
    >
      <primitive ref={root} object={scene} dispose={null} />
    </group>
  );
}

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError("Asset unavailable · placeholder model");
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function DogModel({
  modelUrl = DOG_MODEL_URL,
  onModelStatus,
  ...props
}) {
  if (!modelUrl) return <PlaceholderDog {...props} />;
  return (
    <ModelBoundary
      key={modelUrl}
      onError={onModelStatus}
      fallback={<PlaceholderDog {...props} />}
    >
      <Suspense fallback={<PlaceholderDog {...props} />}>
        <GLTFDog modelUrl={modelUrl} onModelStatus={onModelStatus} {...props} />
      </Suspense>
    </ModelBoundary>
  );
}
