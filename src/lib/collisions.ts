import type { Division } from "../types/project";

/**
 * Devolve o conjunto de ids de aberturas (porta/janela/balcão) que se
 * sobrepõem a outra abertura na mesma parede da divisão — erro de
 * dimensionamento que o utilizador deve corrigir (ex: duas portas a
 * disputar o mesmo troço de parede).
 */
export function collidingOpeningIds(division: Division): Set<string> {
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
  return colliding;
}
