// Small grounded visual cues help distinguish eating from drinking.
export default function ActionProps({ activity }) {
  if (!["eat", "drink"].includes(activity)) return null;
  return (
    <group position={[0, 0.12, 0.95]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.24, 0.15, 40, 1, true]} />
        <meshStandardMaterial
          color={activity === "drink" ? "#7cabc1" : "#8a9770"}
          side={2}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
        <circleGeometry args={[0.28, 40]} />
        <meshStandardMaterial
          color={activity === "drink" ? "#8bd2de" : "#785336"}
          roughness={activity === "drink" ? 0.2 : 1}
        />
      </mesh>
      {activity === "eat" &&
        Array.from({ length: 9 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(i * 2.4) * 0.16,
              0.065,
              Math.cos(i * 2.4) * 0.16,
            ]}
          >
            <dodecahedronGeometry args={[0.037]} />
            <meshStandardMaterial color="#967046" />
          </mesh>
        ))}
    </group>
  );
}
