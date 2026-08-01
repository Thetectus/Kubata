import { useProjectStore } from "./store/projectStore";
import { Editor2D } from "./components/Editor2D";
import { MaterialsPanel } from "./components/MaterialsPanel";
import { DivisionProperties } from "./components/DivisionProperties";
import "./index.css";

function App() {
  const projectName = useProjectStore((s) => s.project.name);
  const addDivision = useProjectStore((s) => s.addDivision);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Kubata</h1>
        <p style={{ color: "#666", margin: "4px 0 0" }}>{projectName}</p>
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
