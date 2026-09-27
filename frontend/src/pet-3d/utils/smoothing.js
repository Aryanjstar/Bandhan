export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Exponential damping stays consistent across different display refresh rates.
export const damp = (current, target, speed, delta) =>
  current + (target - current) * (1 - Math.exp(-speed * delta));
