import { useState } from "react";
import { useProjectStore } from "../store/projectStore";
import type { GeneratedDivision } from "../store/projectStore";

/** Descreve em texto o que queres construir, e o Kubata tenta preencher
 * o editor com divisões de partida (que depois se ajustam à mão). Usa um
 * modelo de linguagem no servidor — nunca gera uma imagem, só a estrutura
 * de dados que o editor já sabe desenhar. */
export function AiGenerate() {
  const appendGeneratedDivisions = useProjectStore((s) => s.appendGeneratedDivisions);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      const divisions = (data.divisions ?? []) as GeneratedDivision[];
      if (divisions.length === 0) throw new Error("Não recebi nenhuma divisão sugerida.");
      appendGeneratedDivisions(divisions);
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minWidth: 260, fontSize: 14 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Descrever em texto</h2>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ex: uma casa com sala, cozinha e dois quartos"
        rows={3}
        style={{ width: "100%", boxSizing: "border-box" }}
        disabled={loading}
      />
      <button type="button" onClick={handleGenerate} disabled={loading || !description.trim()} style={{ marginTop: 6 }}>
        {loading ? "A gerar…" : "Gerar divisões"}
      </button>
      {error && <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 11, color: "var(--text)", marginTop: 6 }}>
        Adiciona divisões novas ao projecto actual (não substitui o que já lá
        está) — depois ajustas dimensões, blocos e aberturas à mão.
      </p>
    </div>
  );
}
