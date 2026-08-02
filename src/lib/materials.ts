import type { Division, MaterialLine } from "../types/project";
import { blocksPerM2, defaultPricePerUnit, resolveBlockSpec, specKey, type BlockSpec } from "./blocks";
import { totalOpeningsAreaM2 } from "./openings";

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
  const grossArea = perimeter * d.wallHeightM;
  return Math.max(0, grossArea - totalOpeningsAreaM2(d));
}

export function totalWallAreaM2(divisions: Division[]): number {
  return divisions.reduce((sum, d) => sum + wallAreaM2(d), 0);
}

/** Materiais calculados automaticamente a partir das divisões (cimento, areia, blocos). */
export function calculateComputedMaterials(divisions: Division[]): MaterialLine[] {
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
      id: "cimento",
      name: "Cimento (saco 50kg)",
      unit: "saco",
      source: "computed",
      manualQuantity: round2(cimentoKg / 50),
      suggestedPrice: DEFAULT_PRICES.cimentoSaco50kg,
    },
    {
      id: "areia",
      name: "Areia",
      unit: "m3",
      source: "computed",
      manualQuantity: round2(areiaM3),
      suggestedPrice: DEFAULT_PRICES.areiaM3,
    },
  ];

  for (const { spec, quantity } of blocksBySpec.values()) {
    lines.push({
      id: specKey(spec),
      name: spec.name,
      unit: "un",
      source: "computed",
      manualQuantity: Math.ceil(quantity),
      suggestedPrice: defaultPricePerUnit(spec),
    });
  }

  return lines;
}

/** Quantidade final de uma linha: fixa, ou taxa × área total de parede do projecto. */
export function resolveQuantity(line: MaterialLine, totalAreaM2: number): number {
  if (line.coverageRatePerM2 !== undefined) return round2(line.coverageRatePerM2 * totalAreaM2);
  return line.manualQuantity ?? 0;
}

export function totalCost(lines: MaterialLine[], totalAreaM2: number): number {
  return lines.reduce((sum, l) => sum + resolveQuantity(l, totalAreaM2) * (l.userPrice ?? l.suggestedPrice), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
