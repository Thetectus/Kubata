import { useEffect, useState } from "react";
import { useProjectStore } from "./store/projectStore";
import { Editor2D } from "./components/Editor2D";
import { MaterialsPanel } from "./components/MaterialsPanel";
import { DivisionProperties } from "./components/DivisionProperties";
import type { Project } from "./types/project";
import { getPointer, loadProject, saveProject, setPointer } from "./lib/projectSync";
import { PROJECT_TEMPLATES } from "./lib/templates";
import "./index.css";

const KIND_LABELS: Record<Project["kind"], string> = {
  construir: "Construir de raiz",
  remodelar: "Remodelar",
  ampliar: "Ampliar",
};

function App() {
  const project = useProjectStore((s) => s.project);
  const addDivision = useProjectStore((s) => s.addDivision);
  const newProjectFromTemplate = useProjectStore((s) => s.newProjectFromTemplate);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const hydrate = useProjectStore((s) => s.hydrate);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pointer = getPointer();
      const loaded = pointer ? await loadProject(pointer) : null;
      if (cancelled) return;
      if (loaded) {
        hydrate(loaded);
      } else {
        const state = useProjectStore.getState();
        await saveProject({ project: state.project, materials: state.materials });
        setPointer(state.project.id);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Kubata</h1>
        </div>
        <input
          type="text"
          value={project.name}
          onChange={(e) => updateProjectMeta({ name: e.target.value })}
          style={{ fontSize: 16, padding: "4px 8px" }}
        />
        <select
          value={project.kind}
          onChange={(e) => updateProjectMeta({ kind: e.target.value as Project["kind"] })}
        >
          {Object.entries(KIND_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
        <select
          defaultValue=""
          onChange={(e) => {
            const template = PROJECT_TEMPLATES.find((t) => t.id === e.target.value);
            if (!template) return;
            if (
              confirm(
                "Começar um novo projecto a partir deste modelo? O projecto actual guardado (nesta conta) fica no histórico, mas deixa de estar aberto aqui.",
              )
            ) {
              newProjectFromTemplate(template);
            }
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Novo projecto a partir de…
          </option>
          {PROJECT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "#888" }}>
          {ready ? "Guardado automaticamente na cloud" : "A carregar…"}
        </span>
      </header>

      <button type="button" onClick={addDivision} style={{ marginBottom: 12 }} disabled={!ready}>
        + Adicionar divisão
      </button>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Editor2D />
        <DivisionProperties />
        <MaterialsPanel />
      </div>
    </div>
  );
}

export default App;
