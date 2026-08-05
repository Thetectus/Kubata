import type { BlockOverride } from "../lib/blocks";

export type WallSide = "top" | "right" | "bottom" | "left";
export type OpeningType = "porta" | "janela" | "balcao";

export interface Opening {
  id: string;
  side: WallSide;
  type: OpeningType;
  /** metros, distância ao canto inicial do lado */
  offsetM: number;
  widthM: number;
  /** quando definidos, a abertura é "livre": está solta dentro da divisão
   * (coordenadas em metros, relativas ao canto superior esquerdo da
   * divisão) em vez de presa a um lado — usado para balcões que o
   * utilizador queira colocar em qualquer ponto. Quando presentes,
   * `side`/`offsetM` são ignorados para posição (mas mantidos por
   * compatibilidade de tipos). Não é descontada de nenhuma parede.  */
  freeX?: number;
  freeY?: number;
  /** largura/altura do rectângulo livre (metros), medidas a partir de
   * (freeX,freeY) como canto superior esquerdo — só usadas quando
   * freeX/freeY estão definidos. Permite redimensionar em qualquer
   * direcção, tal como uma divisão. */
  freeWidthM?: number;
  freeHeightM?: number;
}

/** Parede livre/independente — não pertence a nenhuma divisão, serve
 * para criar um muro, dividir um espaço, ou servir de suporte a um
 * balcão fora de uma divisão. Só segmentos alinhados aos eixos (x1===x2
 * ou y1===y2), tal como o resto do editor. */
export interface FreeWall {
  id: string;
  label: string;
  /** metros, extremos do segmento */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wallHeightM: number;
  blockSpecId: string;
  blockOverride?: BlockOverride;
  wallColor?: string;
  /** aberturas ao longo do comprimento da parede (offsetM = distância a
   * partir de (x1,y1)); pensado sobretudo para balcões. */
  openings: Opening[];
}

export interface Division {
  id: string;
  label: string;
  /** metros, coordenadas no plano do editor */
  x: number;
  y: number;
  width: number;
  height: number;
  wallHeightM: number;
  blockSpecId: string;
  /** dimensões personalizadas, substituem parcialmente o catálogo */
  blockOverride?: BlockOverride;
  /** cor de acabamento/pintura da parede, se definida pelo utilizador */
  wallColor?: string;
  openings: Opening[];
  /** lados sem parede nenhuma (ex: espaço aberto, acesso a varanda) */
  openWalls?: WallSide[];
}

export type MaterialUnit = "saco" | "m3" | "un" | "kg" | "L" | "m2";

export interface MaterialLine {
  id: string;
  name: string;
  unit: MaterialUnit;
  /** "computed": calculado a partir das divisões (cimento, areia, blocos).
   *  "custom": adicionado livremente pelo utilizador (tinta, gesso, mão-de-obra…) */
  source: "computed" | "custom";
  /** quantidade fixa, usada quando não há taxa de cobertura por m² */
  manualQuantity?: number;
  /** consumo por m² total de parede do projecto (ex: litros de tinta por m²) */
  coverageRatePerM2?: number;
  /** preço sugerido (baseline), em Kz, por unidade */
  suggestedPrice: number;
  /** preço que o utilizador inseriu para este projecto; se undefined, usa suggestedPrice */
  userPrice?: number;
}

export interface Project {
  id: string;
  name: string;
  kind: "construir" | "remodelar" | "ampliar";
  divisions: Division[];
  freeWalls: FreeWall[];
}
