import { AnimationClip } from "three";
import { BODY_ACTIONS } from "../dogConfig.js";

export function findBoneByCandidates(root, candidates = []) {
  const normalized = candidates.map((name) =>
    name.replace(/[_.\s-]/g, "").toLowerCase(),
  );
  let match = null;
  root.traverse((node) => {
    if (
      !match &&
      node.isBone &&
      normalized.includes(node.name.replace(/[_.\s-]/g, "").toLowerCase())
    )
      match = node;
  });
  return match;
}

export function discoverRig(root, config) {
  return Object.fromEntries(
    Object.entries(config.bones || {}).map(([key, candidates]) => [
      key,
      findBoneByCandidates(root, candidates),
    ]),
  );
}

export function inspectDog(root, clips, config) {
  const rig = discoverRig(root, config);
  const bones = [];
  root.traverse((node) => {
    if (node.isBone) bones.push({ name: node.name, parent: node.parent?.name });
  });
  const capabilities = BODY_ACTIONS.map((action) => {
    const clip = clips.find(
      (c) => c.name.toLowerCase() === config.clips[action]?.toLowerCase(),
    );
    const skeletal = action === "scratch" ? !!rig.rearHip : !!rig.neck;
    return {
      action,
      source: clip
        ? "Native clip"
        : skeletal
          ? "Procedural skeleton"
          : "Procedural model",
      clip: clip?.name || null,
    };
  });
  capabilities.push({
    action: "headShake",
    source: "Sensor / procedural neck",
    clip: null,
  });
  return {
    name: config.name || "Custom dog",
    bones,
    clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
    capabilities,
    warnings: ["head", "neck", "body", "rearHip"]
      .filter((key) => !rig[key])
      .map((key) => `Missing ${key} bone; check rig configuration`),
  };
}

export function createHeldPoseClip(source, name, time) {
  const tracks = source.tracks.map((track) => {
    const value = Array.from(track.createInterpolant().evaluate(time));
    const copy = track.clone();
    copy.times = new Float32Array([0, 1]);
    copy.values = new Float32Array([...value, ...value]);
    return copy;
  });
  return new AnimationClip(name, 1, tracks);
}
