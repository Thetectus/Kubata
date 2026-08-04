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
 * seleccionado. Blocos que atravessem uma porta/janela são cortados
 * exactamente no limite da abertura (não omitidos por inteiro — isso
 * deixava um vão maior do que a abertura real). Serve só para o desenho —
 * a quantidade "oficial" vem de lib/materials.ts (cálculo por área, mais
 * preciso que contar blocos 2D).
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

/**
 * Devolve os troços de [start,end) que NÃO são cobertos por nenhuma range
 * (porta/janela/balcão) — em vez de simplesmente omitir o bloco inteiro
 * quando toca numa abertura (o que deixava um vão maior do que a
 * abertura real, "como se faltassem tijolos"), corta o bloco exactamente
 * no limite da abertura, como um bloco cortado numa obra a sério.
 */
function subtractRanges(start: number, end: number, ranges?: OpeningRangePx[]): Array<[number, number]> {
  let segments: Array<[number, number]> = [[start, end]];
  if (!ranges || ranges.length === 0) return segments;
  for (const r of ranges) {
    const rStart = r.offsetPx;
    const rEnd = r.offsetPx + r.widthPx;
    const next: Array<[number, number]> = [];
    for (const [s, e] of segments) {
      if (rEnd <= s || rStart >= e) {
        next.push([s, e]);
        continue;
      }
      if (rStart > s) next.push([s, rStart]);
      if (rEnd < e) next.push([rEnd, e]);
    }
    segments = next;
  }
  return segments;
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
    for (const [segStart, segEnd] of subtractRanges(x - x0, x - x0 + w, ranges)) {
      if (segEnd - segStart > 1) {
        out.push({ key: `${side}-${i}`, x: x0 + segStart, y, width: segEnd - segStart, height: thickness });
        i += 1;
      }
    }
    x += blockLen;
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
    for (const [segStart, segEnd] of subtractRanges(y - y0, y - y0 + h, ranges)) {
      if (segEnd - segStart > 1) {
        out.push({ key: `${side}-${i}`, x, y: y0 + segStart, width: thickness, height: segEnd - segStart });
        i += 1;
      }
    }
    y += blockLen;
  }
}
