// Rotations are radians in the model's Y-up, +Z-forward frame. The controller
// converts them to each inspected bone's local frame before application.
export function proceduralPose(action, time) {
  const tau = Math.PI * 2;
  switch (action) {
    case "drink": {
      const lap = Math.sin(time * tau * 4.2);
      return {
        rotations: {
          neck: [0.18 + 0.025 * lap, 0, 0],
          head: [0.025 * lap, 0, 0],
        },
        translations: { neck: [0, 0, 0.04] },
      };
    }
    case "sniff":
      return {
        rotations: {
          neck: [
            -0.19 + 0.045 * Math.sin(time * 8),
            0.28 * Math.sin(time * 2.1),
            0,
          ],
          neckTip: [0, 0.1 * Math.sin(time * 2.1 + 0.8), 0],
        },
        translations: { root: [0, 0, 0.065 * Math.sin(time * 2.1)] },
      };
    case "scratch": {
      // Lift the left hind paw to the neck/ear, scratch, then plant it again.
      // The inspected chain is solved toward the contact target below.
      const phase = time % 3.2;
      const smooth = (value) => {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
      };
      const lift = smooth(phase / 0.45) * (1 - smooth((phase - 2.45) / 0.5));
      const strokes = smooth((phase - 0.45) / 0.2) *
        (1 - smooth((phase - 2.25) / 0.2));
      const scratch = Math.sin((phase - 0.45) * tau * 4) * strokes;
      return {
        rotations: {
          spine: [0, 0, -0.025 * lift],
          neck: [0.06 * lift, 0.08 * lift, (0.07 + 0.012 * scratch) * lift],
        },
        // The inspected chain is solved after these supporting rotations. The
        // target sits beside the left neck/ear rather than under the belly.
        ikTarget: [0.05, 2.8, 1.85 + 0.12 * scratch],
        ikWeight: lift,
      };
    }
    case "eat":
      return {
        rotations: {
          neck: [
            0.65 + 0.065 * Math.sin(time * 9),
            0.045 * Math.sin(time * 3.7),
            0,
          ],
          head: [0.25, 0, 0],
        },
      };
    case "jump": {
      const t = Math.min(time / 1.6, 1);
      const crouch =
        t < 0.18
          ? Math.sin(((t / 0.18) * Math.PI) / 2)
          : t < 0.28
            ? 1 - (t - 0.18) / 0.1
            : 0;
      const flight =
        t > 0.23 && t < 0.8 ? Math.sin(((t - 0.23) / 0.57) * Math.PI) : 0;
      const landing = t >= 0.8 ? Math.sin(((t - 0.8) / 0.2) * Math.PI) : 0;
      return {
        translations: {
          root: [0, 0.85 * flight - 0.12 * crouch - 0.09 * landing, 0],
        },
        rotations: {
          frontLeft: [0.45 * flight + 0.22 * crouch, 0, 0],
          frontRight: [0.45 * flight + 0.22 * crouch, 0, 0],
          rearLeft: [-0.55 * flight - 0.25 * crouch, 0, 0],
          rearRight: [-0.55 * flight - 0.25 * crouch, 0, 0],
        },
        squash: 1 - 0.1 * crouch - 0.07 * landing,
      };
    }
    case "walk":
    case "run": {
      const stride =
        Math.sin(time * tau * (action === "run" ? 3.2 : 1.6)) *
        (action === "run" ? 0.8 : 0.4);
      return {
        rotations: {
          frontLeft: [stride, 0, 0],
          frontRight: [-stride, 0, 0],
          rearLeft: [-stride, 0, 0],
          rearRight: [stride, 0, 0],
        },
        translations: { root: [0, Math.abs(stride) * 0.08, 0] },
      };
    }
    default:
      return { rotations: {}, translations: {} };
  }
}
