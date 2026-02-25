export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 14, 6]} intensity={1.6} />
      <hemisphereLight args={["#b1e1ff", "#1a5c2a", 0.35]} />
    </>
  );
}
