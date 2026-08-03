import { useState, type CSSProperties } from "react";
import { useProjectStore } from "../store/projectStore";
import { BLOCK_CATALOG, resolveBlockSpec } from "../lib/blocks";
import { WALL_SIDES, sideLengthM } from "../lib/openings";
import type { OpeningType, WallSide } from "../types/project";

const SIDE_LABELS: Record<WallSide, string> = { top: "cima", right: "direita", bottom: "baixo", left: "esquerda" };
const TYPE_LABELS: Record<OpeningType, string> = { porta: "Porta", janela: "Janela", balcao: "Balcão" };

export function DivisionProperties() {
  const divisions = useProjectStore((s) => s.project.divisions);
  const selectedDivisionIds = useProjectStore((s) => s.selectedDivisionIds);
  const selectedOpeningId = useProjectStore((s) => s.selectedOpeningId);
  const updateDivision = useProjectStore((s) => s.updateDivision);
  const removeDivision = useProjectStore((s) => s.removeDivision);
  const removeDivisions = useProjectStore((s) => s.removeDivisions);
  const addOpening = useProjectStore((s) => s.addOpening);
  const removeOpening = useProjectStore((s) => s.removeOpening);
  const selectOpening = useProjectStore((s) => s.selectOpening);

  const [newSide, setNewSide] = useState<WallSide>("bottom");
  const [newType, setNewType] = useState<OpeningType>("porta");
  const [newOffset, setNewOffset] = useState(0.3);
  const [newWidth, setNewWidth] = useState(0.9);

  const division = divisions.find((d) => d.id === selectedDivisionIds[0]);

  function toggleOpenWall(side: WallSide) {
    if (!division) return;
    const current = division.openWalls ?? [];
    const openWalls = current.includes(side) ? current.filter((s) => s !== side) : [...current, side];
    updateDivision(division.id, { openWalls });
  }

  if (selectedDivisionIds.length > 1) {
    return (
      <div style={{ minWidth: 260, fontSize: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>{selectedDivisionIds.length} divisões seleccionadas</h2>
        <p style={{ fontSize: 12, color: "#888" }}>
          Ctrl+C / Ctrl+V copia e cola o grupo todo de uma vez. Para editar
          propriedades individuais, selecciona só uma divisão (clica sem
          Shift).
        </p>
        <button
          type="button"
          onClick={() => removeDivisions(selectedDivisionIds)}
          style={{ marginTop: 8, color: "#b91c1c" }}
        >
          Remover as {selectedDivisionIds.length} divisões
        </button>
      </div>
    );
  }

  if (!division) {
    return (
      <div style={{ minWidth: 260, color: "#888", fontSize: 14 }}>
        Selecciona uma divisão no editor para ver e ajustar as suas
        propriedades (parede, bloco, dimensões).
      </div>
    );
  }

  const spec = resolveBlockSpec(division.blockSpecId, division.blockOverride);
  const isCustom = Boolean(division.blockOverride);

  return (
    <div style={{ minWidth: 260, fontSize: 14 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Propriedades</h2>

      <label style={row}>
        Nome
        <input
          type="text"
          value={division.label}
          onChange={(e) => updateDivision(division.id, { label: e.target.value })}
          style={{ width: 140 }}
        />
      </label>
      <label style={row}>
        Largura (m)
        <input
          type="number"
          step={0.1}
          value={division.width}
          onChange={(e) => updateDivision(division.id, { width: e.target.valueAsNumber || division.width })}
        />
      </label>
      <label style={row}>
        Profundidade (m)
        <input
          type="number"
          step={0.1}
          value={division.height}
          onChange={(e) => updateDivision(division.id, { height: e.target.valueAsNumber || division.height })}
        />
      </label>
      <label style={row}>
        Pé-direito / altura da parede (m)
        <input
          type="number"
          step={0.1}
          value={division.wallHeightM}
          onChange={(e) =>
            updateDivision(division.id, { wallHeightM: e.target.valueAsNumber || division.wallHeightM })
          }
        />
      </label>

      <label style={row}>
        Tipo de bloco/tijolo
        <select
          value={division.blockSpecId}
          onChange={(e) => updateDivision(division.id, { blockSpecId: e.target.value, blockOverride: undefined })}
        >
          {BLOCK_CATALOG.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <p style={{ fontSize: 12, color: "#888", margin: "4px 0" }}>
        Dimensão usada no cálculo e no desenho (comprimento × altura × espessura, cm){" "}
        {isCustom && <strong>— personalizada</strong>}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <DimInput
          label="Compr."
          value={spec.lengthCm}
          onChange={(v) =>
            updateDivision(division.id, {
              blockOverride: { ...division.blockOverride, lengthCm: v },
            })
          }
        />
        <DimInput
          label="Altura"
          value={spec.heightCm}
          onChange={(v) =>
            updateDivision(division.id, {
              blockOverride: { ...division.blockOverride, heightCm: v },
            })
          }
        />
        <DimInput
          label="Espess."
          value={spec.thicknessCm}
          onChange={(v) =>
            updateDivision(division.id, {
              blockOverride: { ...division.blockOverride, thicknessCm: v },
            })
          }
        />
      </div>
      {isCustom && (
        <button
          type="button"
          onClick={() => updateDivision(division.id, { blockOverride: undefined })}
          style={{ fontSize: 12, marginTop: 6 }}
        >
          Repor dimensão padrão
        </button>
      )}

      <label style={row}>
        Cor da parede / acabamento
        <input
          type="color"
          value={division.wallColor ?? "#b7b0a3"}
          onChange={(e) => updateDivision(division.id, { wallColor: e.target.value })}
        />
      </label>
      {division.wallColor && (
        <button
          type="button"
          onClick={() => updateDivision(division.id, { wallColor: undefined })}
          style={{ fontSize: 12, marginBottom: 6 }}
        >
          Repor cor padrão do bloco
        </button>
      )}

      <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>Paredes</h3>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>
        Remove por completo a parede de um lado (ex: espaço aberto, acesso a
        varanda) — deixa de contar para o cálculo de materiais.
      </p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {WALL_SIDES.map((s) => {
          const isOpen = (division.openWalls ?? []).includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleOpenWall(s)}
              style={{ fontSize: 12, background: isOpen ? "#fde68a" : undefined }}
            >
              {SIDE_LABELS[s]}: {isOpen ? "sem parede" : "com parede"}
            </button>
          );
        })}
      </div>

      <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>Portas, janelas e balcões</h3>
      {division.openings.length === 0 && (
        <p style={{ fontSize: 12, color: "#888" }}>Nenhuma abertura adicionada.</p>
      )}
      {division.openings.length > 0 && (
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>
          Clica num item para o destacar no desenho.
        </p>
      )}
      <div style={{ marginBottom: 6 }}>
        {division.openings.map((o) => {
          const isSelected = o.id === selectedOpeningId;
          return (
            <div
              key={o.id}
              onClick={() => selectOpening(isSelected ? null : o.id)}
              style={{
                ...row,
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
                background: isSelected ? "#fde3ef" : undefined,
                border: isSelected ? "1px solid #ff3b8d" : "1px solid transparent",
              }}
            >
              <span>
                {TYPE_LABELS[o.type]} — lado {SIDE_LABELS[o.side]}, {o.widthM}m (a {o.offsetM}m do canto)
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOpening(division.id, o.id);
                }}
                aria-label="Remover abertura"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <select value={newType} onChange={(e) => setNewType(e.target.value as OpeningType)}>
          <option value="porta">Porta</option>
          <option value="janela">Janela</option>
          <option value="balcao">Balcão</option>
        </select>
        <select value={newSide} onChange={(e) => setNewSide(e.target.value as WallSide)}>
          {WALL_SIDES.map((s) => (
            <option key={s} value={s}>
              lado {SIDE_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="number"
          step={0.1}
          value={newOffset}
          onChange={(e) => setNewOffset(e.target.valueAsNumber || 0)}
          style={{ width: 50 }}
          title="Distância ao canto (m)"
        />
        <input
          type="number"
          step={0.1}
          value={newWidth}
          onChange={(e) => setNewWidth(e.target.valueAsNumber || 0.1)}
          style={{ width: 50 }}
          title="Largura (m)"
        />
        <button
          type="button"
          onClick={() => {
            const maxOffset = Math.max(0, sideLengthM(division, newSide) - newWidth);
            addOpening(division.id, {
              type: newType,
              side: newSide,
              offsetM: Math.min(newOffset, maxOffset),
              widthM: newWidth,
            });
          }}
        >
          + Adicionar
        </button>
      </div>

      <button
        type="button"
        onClick={() => removeDivision(division.id)}
        style={{ marginTop: 16, color: "#b91c1c" }}
      >
        Remover divisão
      </button>
    </div>
  );
}

function DimInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666" }}>
      {label}
      <input
        type="number"
        step={0.5}
        value={value}
        style={{ width: 60 }}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (!Number.isNaN(v) && v > 0) onChange(v);
        }}
      />
    </label>
  );
}

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};
