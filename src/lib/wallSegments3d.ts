import type { Division, FreeWall, WallSide } from "../types/project";
import { WALL_SIDES, freeWallLengthM, sideLengthM } from "./openings";
import type { HiddenSegment } from "./adjacency";

export interface WallSegment3D {
  side: WallSide;
  startM: number;
  lengthM: number;
}

/** Divide cada lado da divisão em segmentos de parede, saltando as
 * portas/janelas/balcões e os troços partilhados com uma divisão vizinha
 * (deixa um vão nesses troços) — versão simplificada da mesma ideia usada
 * no desenho 2D (wallBlocks.ts), mas sem granularidade de bloco a bloco,
 * só para a maquete 3D. */
export function wallSegments3D(division: Division, hidden: HiddenSegment[] = []): WallSegment3D[] {
  const segments: WallSegment3D[] = [];
  const open = new Set(division.openWalls ?? []);
  for (const side of WALL_SIDES) {
    if (open.has(side)) continue;
    const total = sideLengthM(division, side);
    const ranges = [
      ...division.openings
        .filter((o) => o.side === side && o.freeX === undefined && o.freeY === undefined)
        .map((o) => [o.offsetM, o.offsetM + o.widthM] as const),
      ...hidden.filter((h) => h.side === side).map((h) => [h.startM, h.startM + h.lengthM] as const),
    ].sort((a, b) => a[0] - b[0]);

    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) segments.push({ side, startM: cursor, lengthM: start - cursor });
      cursor = Math.max(cursor, end);
    }
    if (cursor < total) segments.push({ side, startM: cursor, lengthM: total - cursor });
  }
  return segments;
}

export interface FreeWallSegment3D {
  startM: number;
  lengthM: number;
}

/** Mesma ideia de "cortar vãos", mas para uma parede livre — não tem
 * lados, só um comprimento com aberturas ao longo dele. */
export function freeWallSegments3D(wall: FreeWall): FreeWallSegment3D[] {
  const total = freeWallLengthM(wall);
  const ranges = wall.openings.map((o) => [o.offsetM, o.offsetM + o.widthM] as const).sort((a, b) => a[0] - b[0]);
  const segments: FreeWallSegment3D[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ startM: cursor, lengthM: start - cursor });
    cursor = Math.max(cursor, end);
  }
  if (cursor < total) segments.push({ startM: cursor, lengthM: total - cursor });
  return segments;
}
