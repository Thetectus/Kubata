import type { Division, WallSide } from "../types/project";
import { WALL_SIDES, sideLengthM } from "./openings";

export interface WallSegment3D {
  side: WallSide;
  startM: number;
  lengthM: number;
}

/** Divide cada lado da divisão em segmentos de parede, saltando as
 * portas/janelas (deixa um vão nesse troço) — versão simplificada da
 * mesma ideia usada no desenho 2D (wallBlocks.ts), mas sem granularidade
 * de bloco a bloco, só para a maquete 3D. */
export function wallSegments3D(division: Division): WallSegment3D[] {
  const segments: WallSegment3D[] = [];
  for (const side of WALL_SIDES) {
    const total = sideLengthM(division, side);
    const ranges = division.openings
      .filter((o) => o.side === side)
      .map((o) => [o.offsetM, o.offsetM + o.widthM] as const)
      .sort((a, b) => a[0] - b[0]);

    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) segments.push({ side, startM: cursor, lengthM: start - cursor });
      cursor = Math.max(cursor, end);
    }
    if (cursor < total) segments.push({ side, startM: cursor, lengthM: total - cursor });
  }
  return segments;
}
