import type { BlockOverride } from "../lib/blocks";

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
}
