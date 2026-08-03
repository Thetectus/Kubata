import { useState } from "react";
import type { OpeningType } from "../types/project";

const ITEMS: { type: OpeningType; label: string; color: string }[] = [
  { type: "porta", label: "Porta", color: "#7c4a1e" },
  { type: "janela", label: "Janela", color: "#8fc7e8" },
  { type: "balcao", label: "Balcão", color: "#d9a441" },
];

/** Paleta flutuante no canto superior direito do canvas — arrasta um item
 * para dentro de uma divisão para lhe adicionar essa abertura na parede
 * mais próxima do ponto onde largares. */
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
        border: "1px solid #ddd",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ border: "none", background: "transparent", padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
      >
        + Elementos
      </button>
      {open && (
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 10, color: "#888", margin: "0 0 2px" }}>Arrasta para uma divisão</p>
          {ITEMS.map((item) => (
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
        </div>
      )}
    </div>
  );
}
