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
  materialId: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  /** preço sugerido (baseline), em Kz, por unidade */
  suggestedPrice: number;
  /** preço que o utilizador inseriu para este projecto; se undefined, usa suggestedPrice */
  userPrice?: number;
}

/** item de conta adicionado livremente pelo utilizador (tinta, gesso, mão-de-obra, etc.) */
export interface CustomMaterialLine {
  id: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  price: number;
}

export interface Project {
  id: string;
  name: string;
  kind: "construir" | "remodelar" | "ampliar";
  divisions: Division[];
}
