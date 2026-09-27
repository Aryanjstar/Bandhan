import {
  AnimationClip,
  AnimationMixer,
  Euler,
  NumberKeyframeTrack,
  Quaternion,
  Vector3,
  Matrix4,
  LoopOnce,
  LoopRepeat,
} from "three";
import { ANIMATION, ORIENTATION } from "../constants.js";
import { orientationRadians } from "./orientation.js";
import { damp } from "./smoothing.js";
import { normalizeActivity } from "../dogConfig.js";
import { discoverRig, createHeldPoseClip } from "./dogRig.js";
import { proceduralPose } from "./proceduralDogActions.js";

export function createPlaceholderClips() {
  return [
    ["Idle", 2.8, 0.035, 0.025],
    ["Walk", 0.72, 0.48, 0.06],
    ["Run", 0.4, 0.85, 0.14],
  ].map(([name, duration, stride, bounce]) => {
    const times = Array.from({ length: 17 }, (_, i) => (i * duration) / 16);
    const waves = times.map((t) => Math.sin((t / duration) * Math.PI * 2));
    const tracks = [
      new NumberKeyframeTrack(
        "Body.position[y]",
        times,
        waves.map((v) => 0.94 + Math.abs(v) * bounce),
      ),
      new NumberKeyframeTrack(
        "Head.rotation[x]",
        times,
        waves.map((v) => v * 0.035),
      ),
      new NumberKeyframeTrack(
        "Tail.rotation[z]",
        times,
        waves.map((v) => v * 0.18),
      ),
    ];
    ["FrontLeft", "FrontRight", "BackLeft", "BackRight"].forEach((leg, i) => {
      tracks.push(
        new NumberKeyframeTrack(
          `${leg}.rotation[x]`,
          times,
          waves.map((v) => v * stride * ([0, 3].includes(i) ? 1 : -1)),
        ),
      );
    });
    return new AnimationClip(name, duration, tracks);
  });
}

export class DogAnimationController {
  constructor(root, head, clips, config = {}) {
    this.root = root;
    this.head = head;
    this.config = {
      ...ANIMATION,
      ...config,
      clips: { ...ANIMATION.clips, ...config.clips },
    };
    this.orientationConfig = { ...ORIENTATION, ...config.orientation };
    this.mixer = new AnimationMixer(root);
    this.rig = { ...discoverRig(root, config), root };
    const generated = Object.entries(config.poseBases || {}).flatMap(
      ([key, base]) => {
        const source = clips.find((c) => c.name === base.clip);
        return source
          ? [createHeldPoseClip(source, `Procedural_${key}`, base.time)]
          : [];
      },
    );
    this.actions = new Map(
      [...clips, ...generated].map((clip) => [
        clip.name.toLowerCase(),
        this.mixer.clipAction(clip),
      ]),
    );
    this.poses = new Map(
      [
        ...new Set([root, head, ...Object.values(this.rig)].filter(Boolean)),
      ].map((node) => [
        node,
        {
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone(),
        },
      ]),
    );
    this.offset = new Quaternion();
    this.euler = new Euler();
    this.worldQ = new Quaternion();
    this.modelQ = new Quaternion();
    this.localQ = new Quaternion();
    this.inverseQ = new Quaternion();
    this.modelMatrix = new Matrix4();
    this.point = new Vector3();
    this.origin = new Vector3();
    this.worldPoint = new Vector3();
    this.ikTarget = new Vector3();
    this.ikPole = new Vector3();
    this.ikJoint = new Vector3();
    this.ikEnd = new Vector3();
    this.ikToEnd = new Vector3();
    this.ikToTarget = new Vector3();
    this.ikDelta = new Quaternion();
    this.ikWorld = new Quaternion();
    this.ikParent = new Quaternion();
    this.ikPoleVector = new Vector3();
    this.ikKneeVector = new Vector3();
    this.pitch = 0;
    this.roll = 0;
    this.weights = {};
    this.time = 0;
    this.onComplete = null;
    this.finished = (event) => {
      if (event.action === this.current && this.activity === "jump")
        this.completePending = true;
    };
    this.mixer.addEventListener("finished", this.finished);
  }
  setActivity(activity, revision = 0) {
    const normalized = normalizeActivity(activity);
    if (this.activity === normalized && this.revision === revision) return;
    this.activity = normalized;
    this.revision = revision;
    this.time = 0;
    this.completePending = false;
    this.completed = false;
    const name = this.config.clips[normalized] ?? this.config.clips[activity];
    const native = name && this.actions.get(name.toLowerCase());
    this.procedural = !native && normalized !== "headShake";
    const next =
      native ||
      this.actions.get(`procedural_${normalized}`) ||
      this.actions.get(this.config.clips.idle?.toLowerCase());
    if (!next) return;
    if (this.current === next && normalized !== "jump") return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    next.setLoop(
      normalized === "jump" && native ? LoopOnce : LoopRepeat,
      normalized === "jump" && native ? 1 : Infinity,
    );
    next.clampWhenFinished = normalized === "jump";
    if (this.current && this.current !== next)
      next.crossFadeFrom(this.current, this.config.crossfade, false);
    else next.fadeIn(this.config.crossfade);
    this.current = next;
  }
  restore() {
    for (const [node, pose] of this.poses) {
      node.position.copy(pose.position);
      node.quaternion.copy(pose.quaternion);
      node.scale.copy(pose.scale);
    }
  }
  rotateModel(node, x, y, z) {
    if (!node) return;
    this.offset.setFromEuler(this.euler.set(x, y, z));
    node.getWorldQuaternion(this.worldQ);
    // Conjugate a model-space offset into the animated bone's local axes.
    this.localQ
      .copy(this.worldQ)
      .invert()
      .multiply(this.modelQ)
      .multiply(this.offset);
    this.inverseQ.copy(this.modelQ).invert();
    this.localQ.multiply(this.inverseQ).multiply(this.worldQ);
    node.quaternion.multiply(this.localQ);
  }
  translateModel(node, x, y, z) {
    if (!node) return;
    this.origin.set(0, 0, 0).applyMatrix4(this.modelMatrix);
    this.point.set(x, y, z).applyMatrix4(this.modelMatrix).sub(this.origin);
    node.getWorldPosition(this.worldPoint).add(this.point);
    if (node.parent) node.parent.worldToLocal(this.worldPoint);
    node.position.copy(this.worldPoint);
  }
  applyScratchIK(target, weight, chainOverride = null) {
    const chain = chainOverride || [this.rig.rearHip, this.rig.rearKnee, this.rig.rearAnkle].filter(Boolean);
    const ankle = chain[2];
    const end = ankle?.children.find((child) => !child.isBone) || ankle;
    if (chain.length !== 3 || !end || weight < 0.0001) return;
    // This stylized asset's hind chain is slightly short of the neck. A small
    // Scratch-only length assist keeps the paw contact believable without
    // changing the standing, gait, or any other action pose.
    chain.forEach((bone) => {
      const rest = this.poses.get(bone);
      if (rest) bone.scale.y = rest.scale.y * (1 + 0.3 * weight);
    });
    this.ikTarget.set(...target).applyMatrix4(this.modelMatrix);
    end.getWorldPosition(this.ikEnd);
    this.ikTarget.lerp(this.ikEnd, 1 - weight);
    for (let iteration = 0; iteration < 12; iteration += 1) {
      for (let index = chain.length - 1; index >= 0; index -= 1) {
        const bone = chain[index];
        this.root.updateWorldMatrix(true, true);
        bone.getWorldPosition(this.ikJoint);
        end.getWorldPosition(this.ikEnd);
        this.ikToEnd.copy(this.ikEnd).sub(this.ikJoint);
        this.ikToTarget.copy(this.ikTarget).sub(this.ikJoint);
        if (this.ikToEnd.lengthSq() < 1e-8 || this.ikToTarget.lengthSq() < 1e-8) continue;
        this.ikDelta.setFromUnitVectors(this.ikToEnd.normalize(), this.ikToTarget.normalize());
        bone.getWorldQuaternion(this.ikWorld);
        this.ikWorld.premultiply(this.ikDelta);
        if (bone.parent) {
          bone.parent.getWorldQuaternion(this.ikParent).invert();
          bone.quaternion.copy(this.ikParent.multiply(this.ikWorld));
        } else bone.quaternion.copy(this.ikWorld);
      }
    }
    // Select a forward, outside bend for the knee. Without this pole choice
    // the same target has two valid solutions and CCD can arch over the back.
    const hip = chain[0];
    this.root.updateWorldMatrix(true, true);
    hip.getWorldPosition(this.ikJoint);
    chain[1].getWorldPosition(this.ikEnd);
    this.ikPole.set(0.9, 1.9, 0.25).applyMatrix4(this.modelMatrix);
    this.ikPoleVector.copy(this.ikPole).sub(this.ikJoint);
    this.ikToTarget.copy(this.ikTarget).sub(this.ikJoint).normalize();
    this.ikPoleVector.addScaledVector(this.ikToTarget, -this.ikPoleVector.dot(this.ikToTarget));
    this.ikKneeVector.copy(this.ikEnd).sub(this.ikJoint);
    this.ikKneeVector.addScaledVector(this.ikToTarget, -this.ikKneeVector.dot(this.ikToTarget));
    if (this.ikPoleVector.lengthSq() > 1e-8 && this.ikKneeVector.lengthSq() > 1e-8) {
      this.ikDelta.setFromUnitVectors(this.ikKneeVector.normalize(), this.ikPoleVector.normalize());
      hip.getWorldQuaternion(this.ikWorld);
      this.ikWorld.premultiply(this.ikDelta);
      if (hip.parent) {
        hip.parent.getWorldQuaternion(this.ikParent).invert();
        hip.quaternion.copy(this.ikParent.multiply(this.ikWorld));
      } else hip.quaternion.copy(this.ikWorld);
      for (let iteration = 0; iteration < 8; iteration += 1) {
        for (let index = chain.length - 1; index >= 1; index -= 1) {
          const bone = chain[index];
          this.root.updateWorldMatrix(true, true);
          bone.getWorldPosition(this.ikJoint);
          end.getWorldPosition(this.ikEnd);
          this.ikToEnd.copy(this.ikEnd).sub(this.ikJoint);
          this.ikToTarget.copy(this.ikTarget).sub(this.ikJoint);
          if (this.ikToEnd.lengthSq() < 1e-8 || this.ikToTarget.lengthSq() < 1e-8) continue;
          this.ikDelta.setFromUnitVectors(this.ikToEnd.normalize(), this.ikToTarget.normalize());
          bone.getWorldQuaternion(this.ikWorld);
          this.ikWorld.premultiply(this.ikDelta);
          if (bone.parent) {
            bone.parent.getWorldQuaternion(this.ikParent).invert();
            bone.quaternion.copy(this.ikParent.multiply(this.ikWorld));
          } else bone.quaternion.copy(this.ikWorld);
        }
      }
    }
  }
  applyProcedural(delta) {
    const target = this.procedural ? this.activity : null;
    if (target) this.weights[target] ??= 0;
    for (const key of Object.keys(this.weights)) {
      const weight = (this.weights[key] = damp(
        this.weights[key],
        key === target ? 1 : 0,
        12,
        delta,
      ));
      if (weight < 0.0001 && key !== target) {
        delete this.weights[key];
        continue;
      }
      const pose = proceduralPose(key, this.time);
      for (const [part, rotation] of Object.entries(pose.rotations || {}))
        this.rotateModel(this.rig[part], ...rotation.map((v) => v * weight));
      for (const [part, translation] of Object.entries(pose.translations || {}))
        this.translateModel(
          this.rig[part],
          ...translation.map((v) => v * weight),
        );
      if (key === "scratch" && pose.ikTarget) {
        const scratchWeight = pose.ikWeight * weight;
        this.applyScratchIK(pose.ikTarget, scratchWeight);
      }
      if (pose.squash) this.root.scale.y *= 1 + (pose.squash - 1) * weight;
      // An unsuitable custom rig still gets visible whole-model motion.
      if (!this.rig.neck && key !== "jump") {
        this.rotateModel(
          this.root,
          (key === "eat" || key === "drink" || key === "sniff" ? 0.16 : 0) *
            weight,
          0,
          (key === "scratch"
            ? 0.09 * Math.sin(this.time * 22)
            : 0.02 * Math.sin(this.time * 5)) * weight,
        );
      }
    }
  }
  update(delta, orientation, playing = true) {
    const dt = playing ? Math.min(delta, 0.1) : 0;
    this.time += dt;
    // All custom transforms are derived from the mixer pose, never last frame's offsets.
    this.restore();
    this.mixer.update(dt);
    for (const [node, pose] of this.poses) {
      pose.position.copy(node.position);
      pose.quaternion.copy(node.quaternion);
      pose.scale.copy(node.scale);
    }
    this.root.updateWorldMatrix(true, true);
    this.root.getWorldQuaternion(this.modelQ);
    this.modelMatrix.copy(this.root.matrixWorld);
    this.applyProcedural(dt);
    const target = orientationRadians(orientation, this.orientationConfig);
    this.pitch = damp(
      this.pitch,
      target.pitch,
      this.orientationConfig.smoothing,
      delta,
    );
    this.roll = damp(
      this.roll,
      target.roll,
      this.orientationConfig.smoothing,
      delta,
    );
    this.euler.set(0, 0, 0);
    this.euler[this.orientationConfig.pitchAxis] =
      this.pitch * this.orientationConfig.pitchSign;
    this.euler[this.orientationConfig.rollAxis] =
      this.roll * this.orientationConfig.rollSign;
    if (this.head) {
      if (this.orientationConfig.space === "model")
        this.rotateModel(this.head, this.euler.x, this.euler.y, this.euler.z);
      else {
        this.offset.setFromEuler(this.euler);
        this.head.quaternion.multiply(this.offset);
      }
    }
    if (this.activity === "jump" && this.procedural && this.time >= 1.6)
      this.completePending = true;
    if (this.completePending && !this.completed) {
      this.completed = true;
      this.onComplete?.(this.revision);
    }
  }
  dispose() {
    this.restore();
    this.mixer.removeEventListener("finished", this.finished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
