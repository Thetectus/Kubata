import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useProjectStore } from "../store/projectStore";
import { resolveBlockSpec } from "../lib/blocks";
import { wallSegments3D } from "../lib/wallSegments3d";
import type { Division } from "../types/project";

const CATEGORY_COLOR: Record<string, string> = {
  tijolo: "#c96f3c",
  bloco: "#b7b0a3",
};

function DivisionWalls({ division }: { division: Division }) {
  const spec = resolveBlockSpec(division.blockSpecId, division.blockOverride);
  const thickness = spec.thicknessCm / 100;
  const color = division.wallColor ?? CATEGORY_COLOR[spec.category];
  const segments = wallSegments3D(division);

  return (
    <group>
      {segments.map((seg, i) => {
        const isHorizontal = seg.side === "top" || seg.side === "bottom";
        const width = isHorizontal ? seg.lengthM : thickness;
        const depth = isHorizontal ? thickness : seg.lengthM;
        const x =
          division.x +
          (isHorizontal ? seg.startM + seg.lengthM / 2 : seg.side === "left" ? thickness / 2 : division.width - thickness / 2);
        const z =
          division.y +
          (isHorizontal ? (seg.side === "top" ? thickness / 2 : division.height - thickness / 2) : seg.startM + seg.lengthM / 2);

        return (
          <mesh key={i} position={[x, division.wallHeightM / 2, z]}>
            <boxGeometry args={[width, division.wallHeightM, depth]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Maquete 3D bastante simples: extrude as paredes já desenhadas no
 * editor 2D (com vãos onde há portas/janelas). Sem texturas nem
 * mobiliário — só para dar noção volumétrica do espaço. */
export function Preview3D() {
  const divisions = useProjectStore((s) => s.project.divisions);

  const center = divisions.length
    ? {
        x: divisions.reduce((s, d) => s + d.x + d.width / 2, 0) / divisions.length,
        z: divisions.reduce((s, d) => s + d.y + d.height / 2, 0) / divisions.length,
      }
    : { x: 0, z: 0 };

  return (
    <div style={{ minWidth: 340 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Pré-visualização 3D (simples)</h2>
      <div style={{ width: 400, height: 320, background: "#dfe7ea", borderRadius: 8, overflow: "hidden" }}>
        <Canvas camera={{ position: [center.x + 10, 10, center.z + 10], fov: 50 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#eee7d8" />
          </mesh>
          {divisions.map((d) => (
            <DivisionWalls key={d.id} division={d} />
          ))}
          <OrbitControls target={[center.x, 1.5, center.z]} />
        </Canvas>
      </div>
      <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
        Arrasta para rodar, roda o rato para aproximar. Vista de maquete —
        sem texturas nem mobiliário.
      </p>
    </div>
  );
}
