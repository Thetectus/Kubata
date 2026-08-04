import { create } from "zustand";
import type { Division, MaterialLine, Opening, Project, WallSide } from "../types/project";
import { calculateComputedMaterials } from "../lib/materials";
import { BLOCK_CATALOG } from "../lib/blocks";
import type { PersistedProject } from "../lib/projectSync";
import { instantiateTemplate, type ProjectTemplate } from "../lib/templates";

interface ProjectState {
  project: Project;
  materials: MaterialLine[];
  /** conjunto de divisões seleccionadas; a última clicada fica em último lugar (é a "principal") */
  selectedDivisionIds: string[];
  selectedOpeningId: string | null;
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
}

export interface GeneratedDivision {
  label: string;
  widthM: number;
  heightM: number;
  wallHeightM: number;
  openings?: Omit<Opening, "id">[];
}

/** Recalcula as linhas "computed" a partir das divisões, preserva as "custom" tal como estão. */
function recalculate(project: Project, prevMaterials: MaterialLine[]): MaterialLine[] {
  const freshComputed = calculateComputedMaterials(project.divisions).map((line) => {
    const prev = prevMaterials.find((m) => m.id === line.id);
    return prev?.userPrice !== undefined ? { ...line, userPrice: prev.userPrice } : line;
  });
  const custom = prevMaterials.filter((m) => m.source === "custom");
  return [...freshComputed, ...custom];
}

function emptyProject(): Project {
  return { id: crypto.randomUUID(), name: "Novo projecto", kind: "construir", divisions: [] };
}

export const useProjectStore = create<ProjectState>()((set) => ({
  project: emptyProject(),
  materials: [],
  selectedDivisionIds: [],
  selectedOpeningId: null,

  selectOpening: (id) => set({ selectedOpeningId: id }),

  pasteDivisions: (sources) => {
    if (sources.length === 0) return;
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
    set((state) => {
      const divisions = state.project.divisions.map((d) => (d.id === id ? { ...d, ...patch } : d));
      const project = { ...state.project, divisions };
      return { project, materials: recalculate(project, state.materials) };
    });
  },

  removeDivision: (id) => {
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
      if (id === null) return { selectedDivisionIds: [], selectedOpeningId: null };
      if (!additive) return { selectedDivisionIds: [id], selectedOpeningId: null };
      const without = state.selectedDivisionIds.filter((sid) => sid !== id);
      const selectedDivisionIds =
        without.length === state.selectedDivisionIds.length ? [...state.selectedDivisionIds, id] : without;
      return { selectedDivisionIds, selectedOpeningId: null };
    });
  },

  selectAllDivisions: () => {
    set((state) => ({
      selectedDivisionIds: state.project.divisions.map((d) => d.id),
      selectedOpeningId: null,
    }));
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
      const project: Project = { id: crypto.randomUUID(), name, kind, divisions: [] };
      return { project, materials: [], selectedDivisionIds: [], selectedOpeningId: null };
    });
  },

  newProjectFromTemplate: (template) => {
    set(() => {
      const project = instantiateTemplate(template);
      return {
        project,
        materials: recalculate(project, []),
        selectedDivisionIds: project.divisions[0] ? [project.divisions[0].id] : [],
      };
    });
  },

  updateProjectMeta: (patch) => {
    set((state) => ({ project: { ...state.project, ...patch } }));
  },

  hydrate: (payload) => {
    set(() => ({
      project: payload.project,
      materials: payload.materials,
      selectedDivisionIds: [],
      selectedOpeningId: null,
    }));
  },

  addOpening: (divisionId, opening) => {
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
    set((state) => {
      const idSet = new Set(ids);
      const divisions = state.project.divisions.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d));
      const project = { ...state.project, divisions };
      return { project, materials: recalculate(project, state.materials) };
    });
  },
}));

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(15, Math.max(1, n));
}
