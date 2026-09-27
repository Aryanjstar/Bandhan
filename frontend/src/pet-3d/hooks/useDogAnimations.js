import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DogAnimationController } from "../utils/dogAnimation.js";
import { ANIMATION } from "../constants.js";

export function useDogAnimations(
  root,
  clips,
  activity,
  orientation,
  playing,
  modelConfig = ANIMATION,
  revision = 0,
  onComplete,
) {
  const controller = useRef(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    if (!root.current) return;
    const head =
      root.current.getObjectByName(
        modelConfig.sensorBone || modelConfig.headBone || ANIMATION.headBone,
      ) ||
      root.current.getObjectByName(modelConfig.neckBone || ANIMATION.neckBone);
    controller.current = new DogAnimationController(
      root.current,
      head,
      clips,
      modelConfig,
    );
    controller.current.onComplete = (id) => complete.current?.(id);
    return () => {
      controller.current.dispose();
      controller.current = null;
    };
  }, [root, clips, modelConfig]);
  useEffect(() => {
    controller.current?.setActivity(activity, revision);
  }, [activity, revision, clips, modelConfig]);
  useFrame((_, delta) =>
    controller.current?.update(delta, orientation, playing),
  );
}
