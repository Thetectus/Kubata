import { create } from "zustand";
import type { Division, FreeWall, MaterialLine, Opening, Project, WallSide } from "../types/project";
import { calculateComputedMaterials } from "../lib/materials";
import { BLOCK_CATALOG } from "../lib/blocks";
import type { PersistedProject } from "../lib/projectSync";
import { instantiateTemplate, type ProjectTemplate } from "../lib/templates";

const MAX_HISTORY = 30;

interface ProjectState {
  project: Project;
  materials: MaterialLine[];
  /** estados anteriores do projecto, para desfazer (Ctrl+Z / botão "Desfazer") */
  past: Project[];
  /** conjunto de divisões seleccionadas; a última clicada fica em último lugar (é a "principal") */
  selectedDivisionIds: string[];
  selectedOpeningId: string | null;
  /** parede livre seleccionada (mutuamente exclusiva com selectedDivisionIds) */
  selectedFreeWallId: string | null;
  undo: () => void;
  selectOpening: (id: string | null) => void;
  pasteDivisions: (sources: Division[]) => void;
  addDivision: () => void;
  updateDivision: (id: string, patch: Partial<Division>) => void;
  removeDivision: (id: string) => void;
  removeDivisions: (ids: string[]) => void;
  /** selecciona só esta divisão (additive=false), ou junta/tira da selecção actual (additive=true, ex: Shift+clique) */
  selectDivision: (id: string | null, additive?: boolean) => void;
  selectAllDivisions: () => void;
  setUserPrice: (materialId: string, price: number | undefined) => void;
  addCustomMaterial: () => void;
  updateCustomMaterial: (id: string, patch: Partial<MaterialLine>) => void;
  removeCustomMaterial: (id: string) => void;
  newProject: (name: string, kind: Project["kind"]) => void;
  newProjectFromTemplate: (template: ProjectTemplate) => void;
  updateProjectMeta: (patch: Partial<Pick<Project, "name" | "kind">>) => void;
  hydrate: (payload: PersistedProject) => void;
  addOpening: (divisionId: string, opening: Omit<Opening, "id">) => void;
  updateOpening: (divisionId: string, openingId: string, patch: Partial<Omit<Opening, "id">>) => void;
  removeOpening: (divisionId: string, openingId: string) => void;
  appendGeneratedDivisions: (divisions: GeneratedDivision[]) => void;
  addAdjacentDivision: (divisionId: string, side: WallSide) => void;
  /** aplica o mesmo patch a várias divisões de uma vez (edição em bloco, multi-selecção) */
  updateDivisions: (ids: string[], patch: Partial<Division>) => void;
  addFreeWall: (x1: number, y1: number, x2: number, y2: number) => void;
  updateFreeWall: (id: string, patch: Partial<FreeWall>) => void;
  removeFreeWall: (id: string) => void;
  selectFreeWall: (id: string | null) => void;
  addFreeWallOpening: (freeWallId: string, opening: Omit<Opening, "id">) => void;
  updateFreeWallOpening: (freeWallId: string, openingId: string, patch: Partial<Omit<Opening, "id">>) => void;
  removeFreeWallOpening: (freeWallId: string, openingId: string) => void;
}

export interface GeneratedDivision {
  label: string;
  widthM: number;
  heightM: number;
  wallHeightM: number;
  openings?: Omit<Opening, "id">[];
}

/** Recalcula as linhas "computed" a partir das divisões e paredes livres, preserva as "custom" tal como estão. */
function recalculate(project: Project, prevMaterials: MaterialLine[]): MaterialLine[] {
  const freshComputed = calculateComputedMaterials(project.divisions, project.freeWalls).map((line) => {
    const prev = prevMaterials.find((m) => m.id === line.id);
    return prev?.userPrice !== undefined ? { ...line, userPrice: prev.userPrice } : line;
  });
  const custom = prevMaterials.filter((m) => m.source === "custom");
  return [...freshComputed, ...custom];
}

function emptyProject(): Project {
  return { id: crypto.randomUUID(), name: "Novo projecto", kind: "construir", divisions: [], freeWalls: [] };
}

export const useProjectStore = create<ProjectState>()((set, get) => {
  // durante um arrasto (redimensionar, mover) a acção de update é chamada
  // dezenas de vezes por segundo — sem este debounce, um só gesto encheria
  // o histórico inteiro e o "Desfazer" só voltaria um pixel atrás.
  let lastSnapshotAt = 0;
  const SNAPSHOT_DEBOUNCE_MS = 500;

  /** grava o estado actual do projecto no histórico antes de o mutar — chamar
   * no início de toda a acção que altera divisões/paredes/aberturas. */
  function snapshot() {
    const now = Date.now();
    if (now - lastSnapshotAt < SNAPSHOT_DEBOUNCE_MS) return;
    lastSnapshotAt = now;
    set((state) => ({ past: [...state.past.slice(-(MAX_HISTORY - 1)), state.project] }));
  }

  return {
    project: emptyProject(),
    materials: [],
    past: [],
    selectedDivisionIds: [],
    selectedOpeningId: null,
    selectedFreeWallId: null,

    undo: () => {
      const { past, materials } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        project: previous,
        materials: recalculate(previous, materials),
        past: past.slice(0, -1),
        selectedDivisionIds: [],
        selectedOpeningId: null,
        selectedFreeWallId: null,
      });
    },

    selectOpening: (id) => set({ selectedOpeningId: id }),

    pasteDivisions: (sources) => {
      if (sources.length === 0) return;
      snapshot();
      set((state) => {
        const minX = Math.min(...sources.map((s) => s.x));
        const newDivisions: Division[] = sources.map((source) => ({
          ...source,
          id: crypto.randomUUID(),
          label: `${source.label} (cópia)`,
          x: source.x - minX + Math.max(...sources.map((s) => s.x + s.width)) + 1,
          openings: source.openings.map((o) => ({ ...o, id: crypto.randomUUID() })),
        }));
        const divisions = [...state.project.divisions, ...newDivisions];
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: newDivisions.map((d) => d.id),
        };
      });
    },

    addDivision: () => {
      snapshot();
      set((state) => {
        const label = `Divisão ${state.project.divisions.length + 1}`;
        const division: Division = {
          id: crypto.randomUUID(),
          label,
          x: 1 + state.project.divisions.length * 0.5,
          y: 1 + state.project.divisions.length * 0.5,
          width: 4,
          height: 3,
          wallHeightM: 3,
          blockSpecId: BLOCK_CATALOG[1].id,
          openings: [],
        };
        const project = { ...state.project, divisions: [...state.project.divisions, division] };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: [division.id],
        };
      });
    },

    updateDivision: (id, patch) => {
      snapshot();
      set((state) => {
        const divisions = state.project.divisions.map((d) => (d.id === id ? { ...d, ...patch } : d));
        const project = { ...state.project, divisions };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    removeDivision: (id) => {
      snapshot();
      set((state) => {
        const divisions = state.project.divisions.filter((d) => d.id !== id);
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: state.selectedDivisionIds.filter((sid) => sid !== id),
        };
      });
    },

    removeDivisions: (ids) => {
      snapshot();
      set((state) => {
        const idSet = new Set(ids);
        const divisions = state.project.divisions.filter((d) => !idSet.has(d.id));
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: state.selectedDivisionIds.filter((sid) => !idSet.has(sid)),
        };
      });
    },

    selectDivision: (id, additive = false) => {
      set((state) => {
        if (id === null) return { selectedDivisionIds: [], selectedOpeningId: null, selectedFreeWallId: null };
        if (!additive) return { selectedDivisionIds: [id], selectedOpeningId: null, selectedFreeWallId: null };
        const without = state.selectedDivisionIds.filter((sid) => sid !== id);
        const selectedDivisionIds =
          without.length === state.selectedDivisionIds.length ? [...state.selectedDivisionIds, id] : without;
        return { selectedDivisionIds, selectedOpeningId: null, selectedFreeWallId: null };
      });
    },

    selectAllDivisions: () => {
      set((state) => ({
        selectedDivisionIds: state.project.divisions.map((d) => d.id),
        selectedOpeningId: null,
        selectedFreeWallId: null,
      }));
    },

    selectFreeWall: (id) => {
      set({ selectedFreeWallId: id, selectedDivisionIds: [], selectedOpeningId: null });
    },

    setUserPrice: (materialId, price) => {
      set((state) => ({
        materials: state.materials.map((m) => (m.id === materialId ? { ...m, userPrice: price } : m)),
      }));
    },

    addCustomMaterial: () => {
      const item: MaterialLine = {
        id: crypto.randomUUID(),
        name: "Novo item (ex: Tinta, Gesso)",
        unit: "un",
        source: "custom",
        manualQuantity: 1,
        suggestedPrice: 0,
      };
      set((state) => ({ materials: [...state.materials, item] }));
    },

    updateCustomMaterial: (id, patch) => {
      set((state) => ({
        materials: state.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },

    removeCustomMaterial: (id) => {
      set((state) => ({ materials: state.materials.filter((m) => m.id !== id) }));
    },

    newProject: (name, kind) => {
      set(() => {
        const project: Project = { id: crypto.randomUUID(), name, kind, divisions: [], freeWalls: [] };
        return {
          project,
          materials: [],
          past: [],
          selectedDivisionIds: [],
          selectedOpeningId: null,
          selectedFreeWallId: null,
        };
      });
    },

    newProjectFromTemplate: (template) => {
      set(() => {
        const project = instantiateTemplate(template);
        return {
          project,
          materials: recalculate(project, []),
          past: [],
          selectedDivisionIds: project.divisions[0] ? [project.divisions[0].id] : [],
          selectedFreeWallId: null,
        };
      });
    },

    updateProjectMeta: (patch) => {
      set((state) => ({ project: { ...state.project, ...patch } }));
    },

    hydrate: (payload) => {
      set(() => ({
        project: { ...payload.project, freeWalls: payload.project.freeWalls ?? [] },
        materials: payload.materials,
        past: [],
        selectedDivisionIds: [],
        selectedOpeningId: null,
        selectedFreeWallId: null,
      }));
    },

    addOpening: (divisionId, opening) => {
      snapshot();
      set((state) => {
        const divisions = state.project.divisions.map((d) =>
          d.id === divisionId
            ? { ...d, openings: [...d.openings, { ...opening, id: crypto.randomUUID() }] }
            : d,
        );
        const project = { ...state.project, divisions };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    updateOpening: (divisionId, openingId, patch) => {
      snapshot();
      set((state) => {
        const divisions = state.project.divisions.map((d) =>
          d.id === divisionId
            ? { ...d, openings: d.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)) }
            : d,
        );
        const project = { ...state.project, divisions };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    removeOpening: (divisionId, openingId) => {
      snapshot();
      set((state) => {
        const divisions = state.project.divisions.map((d) =>
          d.id === divisionId ? { ...d, openings: d.openings.filter((o) => o.id !== openingId) } : d,
        );
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedOpeningId: state.selectedOpeningId === openingId ? null : state.selectedOpeningId,
        };
      });
    },

    appendGeneratedDivisions: (generated) => {
      snapshot();
      set((state) => {
        let cursorX = state.project.divisions.reduce((max, d) => Math.max(max, d.x + d.width), 0);
        cursorX = cursorX > 0 ? cursorX + 1 : 1;
        const newDivisions: Division[] = generated.map((g) => {
          const division: Division = {
            id: crypto.randomUUID(),
            label: g.label,
            x: cursorX,
            y: 1,
            width: clampDim(g.widthM),
            height: clampDim(g.heightM),
            wallHeightM: g.wallHeightM > 0 ? g.wallHeightM : 3,
            blockSpecId: BLOCK_CATALOG[1].id,
            openings: (g.openings ?? []).map((o) => ({ ...o, id: crypto.randomUUID() })),
          };
          cursorX += division.width + 1;
          return division;
        });
        const divisions = [...state.project.divisions, ...newDivisions];
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: newDivisions[0] ? [newDivisions[0].id] : state.selectedDivisionIds,
        };
      });
    },

    addAdjacentDivision: (divisionId, side) => {
      snapshot();
      set((state) => {
        const src = state.project.divisions.find((d) => d.id === divisionId);
        if (!src) return state;
        let x = src.x;
        let y = src.y;
        if (side === "right") x = src.x + src.width;
        if (side === "left") x = src.x - src.width;
        if (side === "bottom") y = src.y + src.height;
        if (side === "top") y = src.y - src.height;

        const division: Division = {
          id: crypto.randomUUID(),
          label: `Divisão ${state.project.divisions.length + 1}`,
          x,
          y,
          width: src.width,
          height: src.height,
          wallHeightM: src.wallHeightM,
          blockSpecId: src.blockSpecId,
          blockOverride: src.blockOverride,
          openings: [],
        };
        const divisions = [...state.project.divisions, division];
        const project = { ...state.project, divisions };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedDivisionIds: [division.id],
        };
      });
    },

    updateDivisions: (ids, patch) => {
      snapshot();
      set((state) => {
        const idSet = new Set(ids);
        const divisions = state.project.divisions.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d));
        const project = { ...state.project, divisions };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    addFreeWall: (x1, y1, x2, y2) => {
      snapshot();
      set((state) => {
        const wall: FreeWall = {
          id: crypto.randomUUID(),
          label: `Parede ${state.project.freeWalls.length + 1}`,
          x1,
          y1,
          x2,
          y2,
          wallHeightM: 3,
          blockSpecId: BLOCK_CATALOG[1].id,
          openings: [],
        };
        const project = { ...state.project, freeWalls: [...state.project.freeWalls, wall] };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedFreeWallId: wall.id,
          selectedDivisionIds: [],
          selectedOpeningId: null,
        };
      });
    },

    updateFreeWall: (id, patch) => {
      snapshot();
      set((state) => {
        const freeWalls = state.project.freeWalls.map((w) => (w.id === id ? { ...w, ...patch } : w));
        const project = { ...state.project, freeWalls };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    removeFreeWall: (id) => {
      snapshot();
      set((state) => {
        const freeWalls = state.project.freeWalls.filter((w) => w.id !== id);
        const project = { ...state.project, freeWalls };
        return {
          project,
          materials: recalculate(project, state.materials),
          selectedFreeWallId: state.selectedFreeWallId === id ? null : state.selectedFreeWallId,
        };
      });
    },

    addFreeWallOpening: (freeWallId, opening) => {
      snapshot();
      set((state) => {
        const freeWalls = state.project.freeWalls.map((w) =>
          w.id === freeWallId ? { ...w, openings: [...w.openings, { ...opening, id: crypto.randomUUID() }] } : w,
        );
        const project = { ...state.project, freeWalls };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    updateFreeWallOpening: (freeWallId, openingId, patch) => {
      snapshot();
      set((state) => {
        const freeWalls = state.project.freeWalls.map((w) =>
          w.id === freeWallId
            ? { ...w, openings: w.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)) }
            : w,
        );
        const project = { ...state.project, freeWalls };
        return { project, materials: recalculate(project, state.materials) };
      });
    },

    removeFreeWallOpening: (freeWallId, openingId) => {
      snapshot();
      set((state) => {
        const freeWalls = state.project.freeWalls.map((w) =>
          w.id === freeWallId ? { ...w, openings: w.openings.filter((o) => o.id !== openingId) } : w,
        );
        const project = { ...state.project, freeWalls };
        return { project, materials: recalculate(project, state.materials) };
      });
    },
  };
});

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(15, Math.max(1, n));
}
