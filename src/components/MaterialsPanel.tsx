import { useProjectStore } from "../store/projectStore";
import { totalCost } from "../lib/materials";

function formatKz(n: number): string {
  return `${Math.round(n).toLocaleString("pt-PT")} Kz`;
}

export function MaterialsPanel() {
  const materials = useProjectStore((s) => s.materials);
  const setUserPrice = useProjectStore((s) => s.setUserPrice);

  return (
    <div style={{ minWidth: 320 }}>
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
      <p style={{ fontWeight: 600, marginTop: 12 }}>Custo total estimado: {formatKz(totalCost(materials))}</p>
      <p style={{ fontSize: 12, color: "#888" }}>
        Preços sugeridos são um valor de partida — os coeficientes de cálculo ainda
        precisam de validação por um engenheiro civil antes de uso em produção.
      </p>
    </div>
  );
}
