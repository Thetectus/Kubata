import type { WallSide } from "../types/project";
import type { BlockSpec } from "./blocks";

export interface WallBlockRect {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OpeningRangePx {
  offsetPx: number;
  widthPx: number;
}

export type OpeningsBySide = Partial<Record<WallSide, OpeningRangePx[]>>;

const GAP_PX = 1;

/**
 * Gera os blocos visuais (em px) que compõem o contorno de uma divisão,
 * tilados ao longo de cada lado usando o comprimento real do bloco
 * seleccionado. Blocos que caiam dentro de uma porta/janela são omitidos
 * (deixa um vão). Serve só para o desenho — a quantidade "oficial" vem de
 * lib/materials.ts (cálculo por área, mais preciso que contar blocos 2D).
 */
export function generateWallBlocks(
  widthPx: number,
  heightPx: number,
  spec: BlockSpec,
  pxPerMeter: number,
  openings: OpeningsBySide = {},
  openWalls: WallSide[] = [],
): WallBlockRect[] {
  const thickness = Math.max(4, (spec.thicknessCm / 100) * pxPerMeter);
  const blockLen = Math.max(6, (spec.lengthCm / 100) * pxPerMeter);
  const blocks: WallBlockRect[] = [];
  const open = new Set(openWalls);

  if (!open.has("top")) tileRow(blocks, "top", 0, 0, widthPx, thickness, blockLen, openings.top);
  if (!open.has("bottom")) tileRow(blocks, "bottom", 0, heightPx - thickness, widthPx, thickness, blockLen, openings.bottom);
  if (!open.has("left")) tileCol(blocks, "left", 0, thickness, heightPx - 2 * thickness, thickness, blockLen, openings.left);
  if (!open.has("right"))
    tileCol(blocks, "right", widthPx - thickness, thickness, heightPx - 2 * thickness, thickness, blockLen, openings.right);

  return blocks;
}

function overlapsAny(start: number, end: number, ranges?: OpeningRangePx[]): boolean {
  if (!ranges) return false;
  return ranges.some((r) => start < r.offsetPx + r.widthPx && end > r.offsetPx);
}

function tileRow(
  out: WallBlockRect[],
  side: string,
  x0: number,
  y: number,
  totalWidth: number,
  thickness: number,
  blockLen: number,
  ranges: OpeningRangePx[] | undefined,
) {
  let x = x0;
  let i = 0;
  while (x < x0 + totalWidth - 1) {
    const w = Math.min(blockLen - GAP_PX, x0 + totalWidth - x);
    if (w > 1 && !overlapsAny(x - x0, x - x0 + w, ranges)) {
      out.push({ key: `${side}-${i}`, x, y, width: w, height: thickness });
    }
    x += blockLen;
    i += 1;
  }
}

function tileCol(
  out: WallBlockRect[],
  side: string,
  x: number,
  y0: number,
  totalHeight: number,
  thickness: number,
  blockLen: number,
  ranges: OpeningRangePx[] | undefined,
) {
  let y = y0;
  let i = 0;
  while (y < y0 + totalHeight - 1 && totalHeight > 0) {
    const h = Math.min(blockLen - GAP_PX, y0 + totalHeight - y);
    if (h > 1 && !overlapsAny(y - y0, y - y0 + h, ranges)) {
      out.push({ key: `${side}-${i}`, x, y, width: thickness, height: h });
    }
    y += blockLen;
    i += 1;
  }
}
