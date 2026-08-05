import { useState } from "react";
import { useProjectStore } from "../store/projectStore";
import { resolveQuantity, totalCost, totalWallAreaM2 } from "../lib/materials";
import { EyeIcon, EyeOffIcon } from "./icons";
import type { MaterialUnit } from "../types/project";

const UNITS: MaterialUnit[] = ["un", "saco", "m2", "m3", "kg", "L"];

function formatKz(n: number): string {
  return `${Math.round(n).toLocaleString("pt-PT")} Kz`;
}

export function MaterialsPanel() {
  const materials = useProjectStore((s) => s.materials);
  const divisions = useProjectStore((s) => s.project.divisions);
  const freeWalls = useProjectStore((s) => s.project.freeWalls);
  const setUserPrice = useProjectStore((s) => s.setUserPrice);
  const addCustomMaterial = useProjectStore((s) => s.addCustomMaterial);
  const updateCustomMaterial = useProjectStore((s) => s.updateCustomMaterial);
  const removeCustomMaterial = useProjectStore((s) => s.removeCustomMaterial);
  const [collapsed, setCollapsed] = useState(false);

  const totalArea = totalWallAreaM2(divisions, freeWalls);
  const grandTotal = totalCost(materials, totalArea);

  return (
    <div style={{ minWidth: 280, maxWidth: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Materiais e custo</h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir" : "Comprimir"}
          aria-label={collapsed ? "Expandir" : "Comprimir"}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
        >
          {collapsed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <p style={{ fontWeight: 600, margin: "8px 0" }}>Custo total estimado: {formatKz(grandTotal)}</p>

      {!collapsed && (
        <>
          <p style={{ fontSize: 12, color: "var(--text)", margin: "0 0 8px" }}>
            Área total de parede do projecto: {totalArea.toFixed(1)} m² — usada para itens com
            consumo "por m²" (ex: tinta).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th>Material</th>
                  <th>Consumo</th>
                  <th>Qtd.</th>
                  <th>Preço (Kz)</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const quantity = resolveQuantity(m, totalArea);
                  const isCustom = m.source === "custom";
                  const isCoverage = m.coverageRatePerM2 !== undefined;

                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td>
                        {isCustom ? (
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => updateCustomMaterial(m.id, { name: e.target.value })}
                            style={{ width: 140 }}
                          />
                        ) : (
                          m.name
                        )}
                      </td>
                      <td>
                        {isCustom ? (
                          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="checkbox"
                              checked={isCoverage}
                              onChange={(e) =>
                                updateCustomMaterial(m.id, {
                                  coverageRatePerM2: e.target.checked ? 0.3 : undefined,
                                  manualQuantity: e.target.checked ? undefined : (m.manualQuantity ?? 1),
                                })
                              }
                            />
                            por m²
                            {isCoverage && (
                              <input
                                type="number"
                                step={0.01}
                                value={m.coverageRatePerM2}
                                onChange={(e) =>
                                  updateCustomMaterial(m.id, { coverageRatePerM2: e.target.valueAsNumber || 0 })
                                }
                                style={{ width: 55 }}
                              />
                            )}
                          </label>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text)" }}>calculado</span>
                        )}
                      </td>
                      <td>
                        {isCustom && !isCoverage ? (
                          <input
                            type="number"
                            value={m.manualQuantity ?? 0}
                            onChange={(e) =>
                              updateCustomMaterial(m.id, { manualQuantity: e.target.valueAsNumber || 0 })
                            }
                            style={{ width: 55 }}
                          />
                        ) : (
                          quantity
                        )}{" "}
                        {isCustom ? (
                          <select
                            value={m.unit}
                            onChange={(e) => updateCustomMaterial(m.id, { unit: e.target.value as MaterialUnit })}
                          >
                            {UNITS.map((u) => (
                              <option key={u} value={u}>
                                {isCoverage ? `${u}/m²` : u}
                              </option>
                            ))}
                          </select>
                        ) : (
                          m.unit
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={m.userPrice ?? m.suggestedPrice}
                          onChange={(e) => {
                            const value = e.target.valueAsNumber;
                            setUserPrice(m.id, Number.isNaN(value) ? undefined : value);
                          }}
                          style={{ width: 90 }}
                        />
                        {m.userPrice === undefined && <span style={{ fontSize: 11, color: "var(--text)" }}> (sugerido)</span>}
                      </td>
                      <td>{formatKz(quantity * (m.userPrice ?? m.suggestedPrice))}</td>
                      <td>
                        {isCustom && (
                          <button type="button" onClick={() => removeCustomMaterial(m.id)} aria-label="Remover">
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addCustomMaterial} style={{ marginTop: 8 }}>
            + Adicionar item (tinta, gesso, mão-de-obra…)
          </button>

          <p style={{ fontSize: 12, color: "var(--text)", marginTop: 12 }}>
            Preços sugeridos são um valor de partida — os coeficientes de cálculo ainda
            precisam de validação por um engenheiro civil antes de uso em produção.
          </p>
        </>
      )}
    </div>
  );
}
