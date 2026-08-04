import type { Division } from "../types/project";
import type { HiddenSegment } from "./adjacency";

/**
 * Devolve o conjunto de ids de aberturas (porta/janela/balcão) que se
 * sobrepõem a outra abertura na mesma parede da divisão, OU a um troço de
 * parede partilhada com uma divisão vizinha encostada (`hidden`) — nos
 * dois casos é um erro de dimensionamento: não faz sentido ter uma porta
 * ou janela a disputar o mesmo troço de parede que outra abertura, nem
 * uma que caia sobre a parede que já pertence à divisão vizinha.
 */
export function collidingOpeningIds(division: Division, hidden: HiddenSegment[] = []): Set<string> {
  const colliding = new Set<string>();
  const bySide = new Map<string, typeof division.openings>();
  for (const o of division.openings) {
    const list = bySide.get(o.side) ?? [];
    list.push(o);
    bySide.set(o.side, list);
  }
  for (const list of bySide.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const overlap = a.offsetM < b.offsetM + b.widthM && b.offsetM < a.offsetM + a.widthM;
        if (overlap) {
          colliding.add(a.id);
          colliding.add(b.id);
        }
      }
    }
  }
  for (const o of division.openings) {
    for (const h of hidden) {
      if (h.side !== o.side) continue;
      const overlap = o.offsetM < h.startM + h.lengthM && h.startM < o.offsetM + o.widthM;
      if (overlap) colliding.add(o.id);
    }
  }
  return colliding;
}
