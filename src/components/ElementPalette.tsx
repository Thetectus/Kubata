import { useState } from "react";
import type { OpeningType } from "../types/project";

const OPENING_ITEMS: { type: OpeningType; label: string; color: string }[] = [
  { type: "porta", label: "Porta", color: "#7c4a1e" },
  { type: "janela", label: "Janela", color: "#8fc7e8" },
  { type: "balcao", label: "Balcão (livre — larga em qualquer ponto)", color: "#d9a441" },
];

/** Paleta flutuante no canto superior direito do canvas — arrasta um item
 * para dentro de uma divisão para lhe adicionar essa abertura na parede
 * mais próxima do ponto onde largares (excepto o balcão, que fica no
 * ponto exacto onde for largado). Também tem uma "Parede" que podes
 * largar no fundo vazio do canvas para criar um muro/parede livre. */
export function ElementPalette() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 2,
        background: "#fff",
        color: "#1a1a1a",
        border: "1px solid #ddd",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          padding: "7px 12px",
          fontSize: 12,
          cursor: "pointer",
          borderRadius: open ? "8px 8px 0 0" : 8,
        }}
      >
        + Elementos
      </button>
      {open && (
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6, width: 190 }}>
          <p style={{ fontSize: 10, color: "#666", margin: "0 0 2px" }}>
            Arrasta para uma divisão (ou para o fundo vazio, no caso da parede)
          </p>
          {OPENING_ITEMS.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-kubata-opening", item.type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 6px",
                border: "1px solid #eee",
                borderRadius: 4,
                cursor: "grab",
                userSelect: "none",
              }}
            >
              <span style={{ width: 12, height: 12, background: item.color, borderRadius: 2, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-kubata-wall", "1");
              e.dataTransfer.effectAllowed = "copy";
            }}
            onDragEnd={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 6px",
              border: "1px solid #eee",
              borderRadius: 4,
              cursor: "grab",
              userSelect: "none",
              marginTop: 4,
            }}
          >
            <span style={{ width: 12, height: 12, background: "#8a5a2b", borderRadius: 2, flexShrink: 0 }} />
            Parede livre (muro, dividir espaço)
          </div>
        </div>
      )}
    </div>
  );
}
