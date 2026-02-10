export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[8, 12, 8]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 10, -4]} intensity={0.5} />
      <pointLight position={[0, 8, 10]} intensity={0.6} color="#ffeedd" />
      <pointLight position={[0, 6, -6]} intensity={0.3} color="#ccddff" />
      <hemisphereLight args={["#b1e1ff", "#1a5c2a", 0.4]} />
    </>
  );
}
