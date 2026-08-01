import type { Division, MaterialLine } from "../types/project";
import { blocksPerM2, defaultPricePerUnit, resolveBlockSpec, specKey, type BlockSpec } from "./blocks";

/**
 * Coeficientes de argamassa por m² de parede (regras de dimensionamento
 * comuns na construção civil, NÃO dados oficiais de uma fonte angolana
 * específica). Precisam de validação por um engenheiro civil antes de
 * qualquer uso em produção — ver sessions/kubata/ no vault.
 */
const MORTAR_COEFFICIENTS: Record<BlockSpec["category"], { cimentoKgPorM2: number; areiaM3PorM2: number }> = {
  tijolo: { cimentoKgPorM2: 8, areiaM3PorM2: 0.03 },
  bloco: { cimentoKgPorM2: 10, areiaM3PorM2: 0.035 },
};

export const DEFAULT_PRICES = {
  cimentoSaco50kg: 5000,
  areiaM3: 12000,
} as const;

export function wallAreaM2(d: Division): number {
  const perimeter = 2 * (d.width + d.height);
  return perimeter * d.wallHeightM;
}

export function calculateMaterials(divisions: Division[]): MaterialLine[] {
  let cimentoKg = 0;
  let areiaM3 = 0;
  const blocksBySpec = new Map<string, { spec: BlockSpec; quantity: number }>();

  for (const d of divisions) {
    const area = wallAreaM2(d);
    const spec = resolveBlockSpec(d.blockSpecId, d.blockOverride);
    const mortar = MORTAR_COEFFICIENTS[spec.category];
    cimentoKg += area * mortar.cimentoKgPorM2;
    areiaM3 += area * mortar.areiaM3PorM2;

    const key = specKey(spec);
    const quantity = area * blocksPerM2(spec);
    const existing = blocksBySpec.get(key);
    if (existing) existing.quantity += quantity;
    else blocksBySpec.set(key, { spec, quantity });
  }

  const lines: MaterialLine[] = [
    {
      materialId: "cimento",
      name: "Cimento (saco 50kg)",
      unit: "saco",
      quantity: round2(cimentoKg / 50),
      suggestedPrice: DEFAULT_PRICES.cimentoSaco50kg,
    },
    {
      materialId: "areia",
      name: "Areia",
      unit: "m3",
      quantity: round2(areiaM3),
      suggestedPrice: DEFAULT_PRICES.areiaM3,
    },
  ];

  for (const { spec, quantity } of blocksBySpec.values()) {
    lines.push({
      materialId: specKey(spec),
      name: spec.name,
      unit: "un",
      quantity: Math.ceil(quantity),
      suggestedPrice: defaultPricePerUnit(spec),
    });
  }

  return lines;
}

export function totalCost(lines: MaterialLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * (l.userPrice ?? l.suggestedPrice), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
