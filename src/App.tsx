import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useProjectStore } from "./store/projectStore";
import { Editor2D } from "./components/Editor2D";
import { MaterialsPanel } from "./components/MaterialsPanel";
import { DivisionProperties } from "./components/DivisionProperties";
import { AiGenerate } from "./components/AiGenerate";
import { LoadingScreen } from "./components/LoadingScreen";
import type { Project } from "./types/project";

// Escondido até haver ANTHROPIC_API_KEY configurada no Vercel (custo por
// chamada — só se liga quando o Kiko decidir). Ver sessions/kubata/ no vault.
const AI_GENERATE_ENABLED = import.meta.env.VITE_ENABLE_AI_GENERATE === "true";

// three.js/@react-three só carregam quando o utilizador pede a pré-visualização
// 3D — evita meter ~1MB no bundle inicial, importante em ligações fracas.
const Preview3D = lazy(() => import("./components/Preview3D").then((m) => ({ default: m.Preview3D })));
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
  const pastLength = useProjectStore((s) => s.past.length);
  const addDivision = useProjectStore((s) => s.addDivision);
  const undo = useProjectStore((s) => s.undo);
  const newProjectFromTemplate = useProjectStore((s) => s.newProjectFromTemplate);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const hydrate = useProjectStore((s) => s.hydrate);

  const [ready, setReady] = useState(false);
  const [show3D, setShow3D] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFadingOut(true), 4200);
    const removeTimer = setTimeout(() => setSplashVisible(false), 4700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

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

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === workspaceRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleWorkspaceFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await workspaceRef.current?.requestFullscreen();
      }
    } catch {
      // ecrã inteiro pode não ser permitido neste browser/contexto — sem efeito
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      {splashVisible && <LoadingScreen fadingOut={splashFadingOut} />}
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" onClick={addDivision} disabled={!ready}>
          + Adicionar divisão
        </button>
        <button type="button" onClick={undo} disabled={pastLength === 0} title="Desfaz a última alteração (Ctrl+Z)">
          ↩ Desfazer
        </button>
        {!isFullscreen && (
          <button type="button" onClick={() => setShow3D((v) => !v)}>
            {show3D ? "Ocultar pré-visualização 3D" : "Mostrar pré-visualização 3D"}
          </button>
        )}
        <button type="button" onClick={toggleWorkspaceFullscreen}>
          {isFullscreen ? "Sair do ecrã inteiro" : "Expandir espaço de trabalho"}
        </button>
      </div>

      <div
        ref={workspaceRef}
        style={
          isFullscreen
            ? {
                display: "flex",
                gap: 24,
                flexWrap: "nowrap",
                alignItems: "flex-start",
                background: "#ffffff",
                padding: 24,
                overflow: "auto",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
              }
            : { display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }
        }
      >
        {isFullscreen ? (
          <>
            <Editor2D expanded />
            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 380, flex: "0 0 380px" }}>
              {AI_GENERATE_ENABLED && <AiGenerate />}
              <DivisionProperties />
              <MaterialsPanel />
            </div>
          </>
        ) : (
          // uma só coluna, empilhada e centrada: canvas 2D, depois (opcional)
          // 3D, e só depois propriedades/materiais — evita ter duas colunas
          // lado a lado a desalinhar consoante o que está ligado ou não.
          <>
            <Editor2D />
            {show3D && (
              <Suspense fallback={<p style={{ fontSize: 13, color: "#888" }}>A carregar 3D…</p>}>
                <Preview3D />
              </Suspense>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 900, maxWidth: "100%" }}>
              {AI_GENERATE_ENABLED && <AiGenerate />}
              <DivisionProperties />
              <MaterialsPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
