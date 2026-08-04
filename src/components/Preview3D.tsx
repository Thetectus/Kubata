import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useProjectStore } from "../store/projectStore";
import { resolveBlockSpec } from "../lib/blocks";
import { freeWallSegments3D, wallSegments3D } from "../lib/wallSegments3d";
import { freeWallIsHorizontal } from "../lib/openings";
import { computeHiddenSegments, hiddenSegmentsForDivision, type HiddenSegment } from "../lib/adjacency";
import { LoadingScreen } from "./LoadingScreen";
import type { Division, FreeWall } from "../types/project";

const CATEGORY_COLOR: Record<string, string> = {
  tijolo: "#c96f3c",
  bloco: "#b7b0a3",
};

type PreviewSize = "normal" | "medium" | "full";

// Tamanho "normal" igual ao do canvas 2D por defeito (720×520) — para os
// dois ecrãs terem peso visual semelhante lado a lado.
const SIZE_DIMENSIONS: Record<Exclude<PreviewSize, "full">, { width: number; height: number }> = {
  normal: { width: 720, height: 520 },
  medium: { width: 900, height: 620 },
};

function DivisionWalls({ division, hidden }: { division: Division; hidden: HiddenSegment[] }) {
  const spec = resolveBlockSpec(division.blockSpecId, division.blockOverride);
  const thickness = spec.thicknessCm / 100;
  const color = division.wallColor ?? CATEGORY_COLOR[spec.category];
  const segments = wallSegments3D(division, hidden);

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

function FreeWallMesh({ wall }: { wall: FreeWall }) {
  const spec = resolveBlockSpec(wall.blockSpecId, wall.blockOverride);
  const thickness = spec.thicknessCm / 100;
  const color = wall.wallColor ?? CATEGORY_COLOR[spec.category];
  const isHorizontal = freeWallIsHorizontal(wall);
  const startX = Math.min(wall.x1, wall.x2);
  const startY = Math.min(wall.y1, wall.y2);
  const segments = freeWallSegments3D(wall);

  return (
    <group>
      {segments.map((seg, i) => {
        const width = isHorizontal ? seg.lengthM : thickness;
        const depth = isHorizontal ? thickness : seg.lengthM;
        const x = isHorizontal ? startX + seg.startM + seg.lengthM / 2 : wall.x1;
        const z = isHorizontal ? wall.y1 : startY + seg.startM + seg.lengthM / 2;
        return (
          <mesh key={i} position={[x, wall.wallHeightM / 2, z]}>
            <boxGeometry args={[width, wall.wallHeightM, depth]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Maquete 3D bastante simples: extrude as paredes já desenhadas no
 * editor 2D (com vãos onde há portas/janelas, e sem duplicar paredes
 * partilhadas entre divisões encostadas). Sem texturas nem mobiliário —
 * só para dar noção volumétrica do espaço.
 *
 * Suporta 3 tamanhos (tipo YouTube): normal, médio (dentro da página) e
 * ecrã inteiro (Fullscreen API real, para apresentações). */
export function Preview3D() {
  const divisions = useProjectStore((s) => s.project.divisions);
  const freeWalls = useProjectStore((s) => s.project.freeWalls);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<PreviewSize>("normal");
  const [preparingFull, setPreparingFull] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) setSize((s) => (s === "full" ? "medium" : s));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function goFullscreen() {
    setPreparingFull(true);
    try {
      await containerRef.current?.requestFullscreen();
      setSize("full");
    } catch {
      setSize("medium");
    }
    // ecrã de carregamento com a marca, breve, antes de revelar a vista cheia
    setTimeout(() => setPreparingFull(false), 3800);
  }

  function exitFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    setSize("medium");
  }

  const center = divisions.length
    ? {
        x: divisions.reduce((s, d) => s + d.x + d.width / 2, 0) / divisions.length,
        z: divisions.reduce((s, d) => s + d.y + d.height / 2, 0) / divisions.length,
      }
    : { x: 0, z: 0 };

  const dims = size === "full" ? null : SIZE_DIMENSIONS[size];
  const hidden = computeHiddenSegments(divisions);

  return (
    <div style={{ minWidth: 340 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Pré-visualização 3D (simples)</h2>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => setSize("normal")} disabled={size === "normal"} title="Normal">
            Normal
          </button>
          <button type="button" onClick={() => setSize("medium")} disabled={size === "medium"} title="Tamanho médio">
            Médio
          </button>
          <button type="button" onClick={goFullscreen} disabled={preparingFull} title="Ecrã inteiro (para apresentar)">
            Ecrã inteiro
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: dims?.width,
          height: dims?.height,
          background: "#dfe7ea",
          borderRadius: size === "full" ? 0 : 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {preparingFull && <LoadingScreen fadingOut={false} />}
        {size === "full" && (
          <button
            type="button"
            onClick={exitFullscreen}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
          >
            Sair do ecrã inteiro
          </button>
        )}
        <Canvas camera={{ position: [center.x + 10, 10, center.z + 10], fov: 50 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#eee7d8" />
          </mesh>
          {divisions.map((d) => (
            <DivisionWalls key={d.id} division={d} hidden={hiddenSegmentsForDivision(hidden, d.id)} />
          ))}
          {freeWalls.map((w) => (
            <FreeWallMesh key={w.id} wall={w} />
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
