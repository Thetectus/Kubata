import type { Division, WallSide } from "../types/project";

const EPSILON_M = 0.05;

export interface HiddenSegment {
  /** a divisão que NÃO desenha/conta esta parede (a outra, que aparece
   * primeiro na lista, é sempre a "dona" — regra simples e determinística) */
  divisionId: string;
  side: WallSide;
  startM: number;
  lengthM: number;
}

/**
 * Quando duas divisões ficam encostadas, a parede na fronteira é
 * partilhada — só uma das duas deve desenhar/contar essa parte, senão
 * o cálculo de materiais duplica-a. Detecta essas fronteiras (lados que
 * se tocam com sobreposição) e devolve qual das divisões deve "esconder"
 * esse troço.
 */
export function computeHiddenSegments(divisions: Division[]): HiddenSegment[] {
  const hidden: HiddenSegment[] = [];
  for (let i = 0; i < divisions.length; i++) {
    for (let j = i + 1; j < divisions.length; j++) {
      const a = divisions[i];
      const b = divisions[j];

      if (Math.abs(a.x + a.width - b.x) < EPSILON_M) {
        const overlap = rangeOverlap(a.y, a.y + a.height, b.y, b.y + b.height);
        if (overlap) hidden.push({ divisionId: b.id, side: "left", startM: overlap[0] - b.y, lengthM: overlap[1] - overlap[0] });
      }
      if (Math.abs(b.x + b.width - a.x) < EPSILON_M) {
        const overlap = rangeOverlap(a.y, a.y + a.height, b.y, b.y + b.height);
        if (overlap) hidden.push({ divisionId: b.id, side: "right", startM: overlap[0] - b.y, lengthM: overlap[1] - overlap[0] });
      }
      if (Math.abs(a.y + a.height - b.y) < EPSILON_M) {
        const overlap = rangeOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
        if (overlap) hidden.push({ divisionId: b.id, side: "top", startM: overlap[0] - b.x, lengthM: overlap[1] - overlap[0] });
      }
      if (Math.abs(b.y + b.height - a.y) < EPSILON_M) {
        const overlap = rangeOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
        if (overlap) hidden.push({ divisionId: b.id, side: "bottom", startM: overlap[0] - b.x, lengthM: overlap[1] - overlap[0] });
      }
    }
  }
  return hidden;
}

export function hiddenSegmentsForDivision(hidden: HiddenSegment[], divisionId: string): HiddenSegment[] {
  return hidden.filter((h) => h.divisionId === divisionId);
}

function rangeOverlap(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const start = Math.max(a0, b0);
  const end = Math.min(a1, b1);
  return end - start > 0.01 ? [start, end] : null;
}
