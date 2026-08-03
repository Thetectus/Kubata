export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guideX?: number;
  guideY?: number;
}

/** Alinhamento tipo PowerPoint: ao mover, encaixa nas margens/centros das
 * outras divisões quando a diferença é pequena, e devolve a posição da
 * linha-guia (em metros) a desenhar, se houver encaixe. */
export function snapPosition(dragged: Rect2D, others: Rect2D[], thresholdM: number): SnapResult {
  let x = dragged.x;
  let y = dragged.y;
  let guideX: number | undefined;
  let guideY: number | undefined;
  let bestDx = thresholdM;
  let bestDy = thresholdM;

  const draggedXCandidates = (dx: number) => [dx, dx + dragged.width / 2, dx + dragged.width];

  for (const other of others) {
    const otherXLines = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherYLines = [other.y, other.y + other.height / 2, other.y + other.height];

    for (const [i, dxLine] of draggedXCandidates(dragged.x).entries()) {
      for (const oxLine of otherXLines) {
        const diff = Math.abs(dxLine - oxLine);
        if (diff < bestDx) {
          bestDx = diff;
          const offset = i === 0 ? 0 : i === 1 ? dragged.width / 2 : dragged.width;
          x = oxLine - offset;
          guideX = oxLine;
        }
      }
    }

    const draggedYCandidates = [dragged.y, dragged.y + dragged.height / 2, dragged.y + dragged.height];
    for (const [i, dyLine] of draggedYCandidates.entries()) {
      for (const oyLine of otherYLines) {
        const diff = Math.abs(dyLine - oyLine);
        if (diff < bestDy) {
          bestDy = diff;
          const offset = i === 0 ? 0 : i === 1 ? dragged.height / 2 : dragged.height;
          y = oyLine - offset;
          guideY = oyLine;
        }
      }
    }
  }

  return { x, y, guideX, guideY };
}
