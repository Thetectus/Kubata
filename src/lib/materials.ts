import type { Division, MaterialLine, WallType } from "../types/project";

/**
 * Coeficientes por m² de parede (regras de dimensionamento comuns na
 * construção civil, NÃO dados oficiais de uma fonte angolana específica).
 * Servem para o cálculo inicial do MVP e precisam de validação por um
 * engenheiro civil antes de qualquer uso em produção — ver
 * sessions/kubata/2026-08-01-ambito-publico-e-fluxo.md no vault.
 */
const WALL_COEFFICIENTS: Record<
  WallType,
  { blocosPorM2: number; cimentoKgPorM2: number; areiaM3PorM2: number }
> = {
  "tijolo-furado": { blocosPorM2: 28, cimentoKgPorM2: 8, areiaM3PorM2: 0.03 },
  "bloco-cimento": { blocosPorM2: 12.5, cimentoKgPorM2: 10, areiaM3PorM2: 0.035 },
};

/**
 * Preços de referência (baseline) em Kz — placeholder inicial a substituir
 * por preços agregados reais (comunidade + parcerias com fornecedores).
 * Ver decisão em sessions/kubata/2026-07-31-diferencial-de-produto.md.
 */
export const DEFAULT_PRICES = {
  cimentoSaco50kg: 5000,
  areiaM3: 12000,
  tijoloFuradoUn: 120,
  blocoCimentoUn: 350,
} as const;

function wallAreaM2(d: Division): number {
  const perimeter = 2 * (d.width + d.height);
  return perimeter * d.wallHeightM;
}

export function calculateMaterials(divisions: Division[]): MaterialLine[] {
  let cimentoKg = 0;
  let areiaM3 = 0;
  let tijoloFuradoUn = 0;
  let blocoCimentoUn = 0;

  for (const d of divisions) {
    const area = wallAreaM2(d);
    const coef = WALL_COEFFICIENTS[d.wallType];
    cimentoKg += area * coef.cimentoKgPorM2;
    areiaM3 += area * coef.areiaM3PorM2;
    if (d.wallType === "tijolo-furado") tijoloFuradoUn += area * coef.blocosPorM2;
    if (d.wallType === "bloco-cimento") blocoCimentoUn += area * coef.blocosPorM2;
  }

  const cimentoSacos = cimentoKg / 50;

  const lines: MaterialLine[] = [
    {
      materialId: "cimento",
      name: "Cimento (saco 50kg)",
      unit: "saco",
      quantity: round2(cimentoSacos),
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

  if (tijoloFuradoUn > 0) {
    lines.push({
      materialId: "tijolo-furado",
      name: "Tijolo furado",
      unit: "un",
      quantity: Math.ceil(tijoloFuradoUn),
      suggestedPrice: DEFAULT_PRICES.tijoloFuradoUn,
    });
  }
  if (blocoCimentoUn > 0) {
    lines.push({
      materialId: "bloco-cimento",
      name: "Bloco de cimento",
      unit: "un",
      quantity: Math.ceil(blocoCimentoUn),
      suggestedPrice: DEFAULT_PRICES.blocoCimentoUn,
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
