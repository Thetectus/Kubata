export type BlockCategory = "tijolo" | "bloco";

export interface BlockSpec {
  id: string;
  name: string;
  category: BlockCategory;
  /** cm, ao longo da parede */
  lengthCm: number;
  /** cm, altura da fiada */
  heightCm: number;
  /** cm, espessura da parede */
  thicknessCm: number;
}

/**
 * Dimensões padrão comuns no mercado (não certificadas para uma marca ou
 * fornecedor angolano específico) — o utilizador pode ajustar por projecto.
 * Ver sessions/kubata/2026-08-01-prototipo-inicial.md no vault.
 */
export const BLOCK_CATALOG: BlockSpec[] = [
  { id: "tijolo-11x24", name: "Tijolo furado 11×24×11", category: "tijolo", lengthCm: 24, heightCm: 11, thicknessCm: 11 },
  { id: "bloco-09x19x39", name: "Bloco de cimento 9×19×39", category: "bloco", lengthCm: 39, heightCm: 19, thicknessCm: 9 },
  { id: "bloco-14x19x39", name: "Bloco de cimento 14×19×39", category: "bloco", lengthCm: 39, heightCm: 19, thicknessCm: 14 },
  { id: "bloco-19x19x39", name: "Bloco de cimento 19×19×39", category: "bloco", lengthCm: 39, heightCm: 19, thicknessCm: 19 },
];

export const DEFAULT_JOINT_CM = 1;

export interface BlockOverride {
  lengthCm?: number;
  heightCm?: number;
  thicknessCm?: number;
}

export function resolveBlockSpec(specId: string, override?: BlockOverride): BlockSpec {
  const base = BLOCK_CATALOG.find((b) => b.id === specId) ?? BLOCK_CATALOG[0];
  if (!override) return base;
  const merged = { ...base, ...override };
  const changed =
    merged.lengthCm !== base.lengthCm ||
    merged.heightCm !== base.heightCm ||
    merged.thicknessCm !== base.thicknessCm;
  if (!changed) return merged;
  const kind = base.category === "tijolo" ? "Tijolo" : "Bloco de cimento";
  return {
    ...merged,
    name: `${kind} ${merged.lengthCm}×${merged.heightCm}×${merged.thicknessCm} (personalizado)`,
  };
}

export function specKey(spec: BlockSpec): string {
  return `${spec.id}:${spec.lengthCm}x${spec.heightCm}x${spec.thicknessCm}`;
}

export function blocksPerM2(spec: BlockSpec, jointCm = DEFAULT_JOINT_CM): number {
  const faceM2 = ((spec.lengthCm + jointCm) / 100) * ((spec.heightCm + jointCm) / 100);
  return 1 / faceM2;
}

export function defaultPricePerUnit(spec: BlockSpec): number {
  return spec.category === "tijolo" ? 120 : 350;
}
