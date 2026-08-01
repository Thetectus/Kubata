export type WallType = "tijolo-furado" | "bloco-cimento";

export interface Division {
  id: string;
  label: string;
  /** metros, coordenadas no plano do editor */
  x: number;
  y: number;
  width: number;
  height: number;
  wallType: WallType;
  wallHeightM: number;
}

export type MaterialUnit = "saco" | "m3" | "un" | "kg" | "L";

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

export interface Project {
  id: string;
  name: string;
  kind: "construir" | "remodelar" | "ampliar";
  divisions: Division[];
}
