import { create } from "zustand";
import type { Division, MaterialLine, Opening, Project, WallSide } from "../types/project";
import { calculateComputedMaterials } from "../lib/materials";
import { BLOCK_CATALOG } from "../lib/blocks";
import type { PersistedProject } from "../lib/projectSync";
import { instantiateTemplate, type ProjectTemplate } from "../lib/templates";

interface ProjectState {
  project: Project;
  materials: MaterialLine[];
  selectedDivisionId: string | null;
  addDivision: () => void;
  updateDivision: (id: string, patch: Partial<Division>) => void;
  removeDivision: (id: string) => void;
  selectDivision: (id: string | null) => void;
  setUserPrice: (materialId: string, price: number | undefined) => void;
  addCustomMaterial: () => void;
  updateCustomMaterial: (id: string, patch: Partial<MaterialLine>) => void;
  removeCustomMaterial: (id: string) => void;
  newProject: (name: string, kind: Project["kind"]) => void;
  newProjectFromTemplate: (template: ProjectTemplate) => void;
  updateProjectMeta: (patch: Partial<Pick<Project, "name" | "kind">>) => void;
  hydrate: (payload: PersistedProject) => void;
  addOpening: (divisionId: string, opening: Omit<Opening, "id">) => void;
  removeOpening: (divisionId: string, openingId: string) => void;
  appendGeneratedDivisions: (divisions: GeneratedDivision[]) => void;
  addAdjacentDivision: (divisionId: string, side: WallSide) => void;
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
  selectedDivisionId: null,

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
        selectedDivisionId: division.id,
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
        selectedDivisionId: state.selectedDivisionId === id ? null : state.selectedDivisionId,
      };
    });
  },

  selectDivision: (id) => set({ selectedDivisionId: id }),

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
      return { project, materials: [], selectedDivisionId: null };
    });
  },

  newProjectFromTemplate: (template) => {
    set(() => {
      const project = instantiateTemplate(template);
      return {
        project,
        materials: recalculate(project, []),
        selectedDivisionId: project.divisions[0]?.id ?? null,
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
      selectedDivisionId: null,
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

  removeOpening: (divisionId, openingId) => {
    set((state) => {
      const divisions = state.project.divisions.map((d) =>
        d.id === divisionId ? { ...d, openings: d.openings.filter((o) => o.id !== openingId) } : d,
      );
      const project = { ...state.project, divisions };
      return { project, materials: recalculate(project, state.materials) };
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
        selectedDivisionId: newDivisions[0]?.id ?? state.selectedDivisionId,
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
        selectedDivisionId: division.id,
      };
    });
  },
}));

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(15, Math.max(1, n));
}
