import type { Division, Opening, OpeningType, WallSide } from "../types/project";

/** Alturas padrão (m) usadas para estimar a área de uma abertura — valor de
 * partida comum, não uma norma angolana verificada. */
export const DEFAULT_OPENING_HEIGHT_M: Record<OpeningType, number> = {
  porta: 2.1,
  janela: 1.2,
  balcao: 1.0,
};

export const WALL_SIDES: WallSide[] = ["top", "right", "bottom", "left"];

export function sideLengthM(division: Division, side: WallSide): number {
  return side === "top" || side === "bottom" ? division.width : division.height;
}

export function openingAreaM2(opening: Opening): number {
  return opening.widthM * DEFAULT_OPENING_HEIGHT_M[opening.type];
}

export function totalOpeningsAreaM2(division: Division): number {
  return division.openings.reduce((sum, o) => sum + openingAreaM2(o), 0);
}

/** Área das paredes removidas por completo (lados marcados como abertos). */
export function openWallsAreaM2(division: Division): number {
  const sides = division.openWalls ?? [];
  return sides.reduce((sum, side) => sum + sideLengthM(division, side) * division.wallHeightM, 0);
}
