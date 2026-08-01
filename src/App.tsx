import { useProjectStore } from "./store/projectStore";
import { Editor2D } from "./components/Editor2D";
import { MaterialsPanel } from "./components/MaterialsPanel";
import { DivisionProperties } from "./components/DivisionProperties";
import type { Project } from "./types/project";
import "./index.css";

const KIND_LABELS: Record<Project["kind"], string> = {
  construir: "Construir de raiz",
  remodelar: "Remodelar",
  ampliar: "Ampliar",
};

function App() {
  const project = useProjectStore((s) => s.project);
  const addDivision = useProjectStore((s) => s.addDivision);
  const newProject = useProjectStore((s) => s.newProject);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);

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
        <button
          type="button"
          onClick={() => {
            if (confirm("Começar um novo projecto? O projecto actual guardado será substituído.")) {
              newProject("Novo projecto", "construir");
            }
          }}
        >
          Novo projecto
        </button>
        <span style={{ fontSize: 12, color: "#888" }}>Guardado automaticamente neste dispositivo</span>
      </header>

      <button type="button" onClick={addDivision} style={{ marginBottom: 12 }}>
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
