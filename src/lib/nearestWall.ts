import type { WallSide } from "../types/project";

/**
 * Dado um ponto dentro de uma divisão (em qualquer unidade consistente com
 * width/height, ex: metros ou pixels) e a largura do elemento a colocar,
 * devolve a parede mais próxima e o deslocamento (offset) ao longo dela,
 * já dentro dos limites do lado. Usado tanto para largar um elemento novo
 * da paleta como para arrastar um já existente para outra posição/parede.
 */
export function nearestSideAndOffset(
  point: { x: number; y: number },
  width: number,
  height: number,
  elementWidth: number,
): { side: WallSide; offset: number } {
  const distTop = point.y;
  const distBottom = height - point.y;
  const distLeft = point.x;
  const distRight = width - point.x;
  const min = Math.min(distTop, distBottom, distLeft, distRight);

  let side: WallSide;
  let offset: number;
  let sideLen: number;
  if (min === distTop || min === distBottom) {
    side = min === distTop ? "top" : "bottom";
    offset = point.x - elementWidth / 2;
    sideLen = width;
  } else {
    side = min === distLeft ? "left" : "right";
    offset = point.y - elementWidth / 2;
    sideLen = height;
  }
  offset = Math.max(0, Math.min(offset, Math.max(0, sideLen - elementWidth)));
  return { side, offset };
}
