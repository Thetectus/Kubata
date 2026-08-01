import { useProjectStore } from "../store/projectStore";
import { totalCost } from "../lib/materials";
import type { MaterialUnit } from "../types/project";

const UNITS: MaterialUnit[] = ["un", "saco", "m2", "m3", "kg", "L"];

function formatKz(n: number): string {
  return `${Math.round(n).toLocaleString("pt-PT")} Kz`;
}

export function MaterialsPanel() {
  const materials = useProjectStore((s) => s.materials);
  const customMaterials = useProjectStore((s) => s.customMaterials);
  const setUserPrice = useProjectStore((s) => s.setUserPrice);
  const addCustomMaterial = useProjectStore((s) => s.addCustomMaterial);
  const updateCustomMaterial = useProjectStore((s) => s.updateCustomMaterial);
  const removeCustomMaterial = useProjectStore((s) => s.removeCustomMaterial);

  const customTotal = customMaterials.reduce((sum, m) => sum + m.quantity * m.price, 0);
  const grandTotal = totalCost(materials) + customTotal;

  return (
    <div style={{ minWidth: 340 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Materiais e custo</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Material</th>
            <th>Qtd.</th>
            <th>Preço (Kz)</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.materialId} style={{ borderBottom: "1px solid #eee" }}>
              <td>{m.name}</td>
              <td>
                {m.quantity} {m.unit}
              </td>
              <td>
                <input
                  type="number"
                  value={m.userPrice ?? m.suggestedPrice}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    setUserPrice(m.materialId, Number.isNaN(value) ? undefined : value);
                  }}
                  style={{ width: 90 }}
                />
                {m.userPrice === undefined && (
                  <span style={{ fontSize: 11, color: "#888" }}> (sugerido)</span>
                )}
              </td>
              <td>{formatKz(m.quantity * (m.userPrice ?? m.suggestedPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>
        Outros itens (tinta, gesso, mão-de-obra, acabamentos…)
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {customMaterials.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateCustomMaterial(m.id, { name: e.target.value })}
                  style={{ width: 150 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={m.quantity}
                  onChange={(e) =>
                    updateCustomMaterial(m.id, { quantity: e.target.valueAsNumber || 0 })
                  }
                  style={{ width: 55 }}
                />
                <select
                  value={m.unit}
                  onChange={(e) => updateCustomMaterial(m.id, { unit: e.target.value as MaterialUnit })}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={m.price}
                  onChange={(e) => updateCustomMaterial(m.id, { price: e.target.valueAsNumber || 0 })}
                  style={{ width: 90 }}
                />
              </td>
              <td>{formatKz(m.quantity * m.price)}</td>
              <td>
                <button type="button" onClick={() => removeCustomMaterial(m.id)} aria-label="Remover">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addCustomMaterial} style={{ marginTop: 8 }}>
        + Adicionar item
      </button>

      <p style={{ fontWeight: 600, marginTop: 12 }}>Custo total estimado: {formatKz(grandTotal)}</p>
      <p style={{ fontSize: 12, color: "#888" }}>
        Preços sugeridos são um valor de partida — os coeficientes de cálculo ainda
        precisam de validação por um engenheiro civil antes de uso em produção.
      </p>
    </div>
  );
}
