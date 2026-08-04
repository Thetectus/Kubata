import type { Division, FreeWall, MaterialLine } from "../types/project";
import { blocksPerM2, defaultPricePerUnit, resolveBlockSpec, specKey, type BlockSpec } from "./blocks";
import { freeWallAreaM2, openWallsAreaM2, totalOpeningsAreaM2 } from "./openings";
import { computeHiddenSegments, hiddenSegmentsForDivision } from "./adjacency";

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

/** Área de parede de uma divisão, descontando aberturas, lados sem parede,
 * e o troço partilhado com uma divisão vizinha encostada (para não contar
 * a mesma parede duas vezes). */
export function wallAreaM2(d: Division, sharedWithNeighboursM = 0): number {
  const perimeter = 2 * (d.width + d.height);
  const grossArea = perimeter * d.wallHeightM;
  return Math.max(0, grossArea - totalOpeningsAreaM2(d) - openWallsAreaM2(d) - sharedWithNeighboursM * d.wallHeightM);
}

export function totalWallAreaM2(divisions: Division[], freeWalls: FreeWall[] = []): number {
  const hidden = computeHiddenSegments(divisions);
  const divisionsArea = divisions.reduce((sum, d) => {
    const sharedM = hiddenSegmentsForDivision(hidden, d.id).reduce((s, h) => s + h.lengthM, 0);
    return sum + wallAreaM2(d, sharedM);
  }, 0);
  const freeWallsArea = freeWalls.reduce((sum, w) => sum + freeWallAreaM2(w), 0);
  return divisionsArea + freeWallsArea;
}

/** Materiais calculados automaticamente a partir das divisões e paredes livres (cimento, areia, blocos). */
export function calculateComputedMaterials(divisions: Division[], freeWalls: FreeWall[] = []): MaterialLine[] {
  let cimentoKg = 0;
  let areiaM3 = 0;
  const blocksBySpec = new Map<string, { spec: BlockSpec; quantity: number }>();
  const hidden = computeHiddenSegments(divisions);

  function addWallArea(area: number, spec: BlockSpec) {
    const mortar = MORTAR_COEFFICIENTS[spec.category];
    cimentoKg += area * mortar.cimentoKgPorM2;
    areiaM3 += area * mortar.areiaM3PorM2;

    const key = specKey(spec);
    const quantity = area * blocksPerM2(spec);
    const existing = blocksBySpec.get(key);
    if (existing) existing.quantity += quantity;
    else blocksBySpec.set(key, { spec, quantity });
  }

  for (const d of divisions) {
    const sharedM = hiddenSegmentsForDivision(hidden, d.id).reduce((s, h) => s + h.lengthM, 0);
    const area = wallAreaM2(d, sharedM);
    const spec = resolveBlockSpec(d.blockSpecId, d.blockOverride);
    addWallArea(area, spec);
  }

  for (const w of freeWalls) {
    const area = freeWallAreaM2(w);
    const spec = resolveBlockSpec(w.blockSpecId, w.blockOverride);
    addWallArea(area, spec);
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
