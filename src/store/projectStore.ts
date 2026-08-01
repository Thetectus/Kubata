import { create } from "zustand";
import type { CustomMaterialLine, Division, MaterialLine, Project } from "../types/project";
import { calculateMaterials } from "../lib/materials";
import { BLOCK_CATALOG } from "../lib/blocks";

interface ProjectState {
  project: Project;
  materials: MaterialLine[];
  customMaterials: CustomMaterialLine[];
  selectedDivisionId: string | null;
  addDivision: () => void;
  updateDivision: (id: string, patch: Partial<Division>) => void;
  removeDivision: (id: string) => void;
  selectDivision: (id: string | null) => void;
  setUserPrice: (materialId: string, price: number | undefined) => void;
  addCustomMaterial: () => void;
  updateCustomMaterial: (id: string, patch: Partial<CustomMaterialLine>) => void;
  removeCustomMaterial: (id: string) => void;
}

function recalculate(project: Project, prevMaterials: MaterialLine[]): MaterialLine[] {
  const fresh = calculateMaterials(project.divisions);
  return fresh.map((line) => {
    const prev = prevMaterials.find((m) => m.materialId === line.materialId);
    return prev?.userPrice !== undefined ? { ...line, userPrice: prev.userPrice } : line;
  });
}

let divisionCounter = 0;
let customMaterialCounter = 0;

export const useProjectStore = create<ProjectState>((set) => ({
  project: {
    id: "projeto-1",
    name: "Novo projecto",
    kind: "construir",
    divisions: [],
  },
  materials: [],
  customMaterials: [],
  selectedDivisionId: null,

  addDivision: () => {
    divisionCounter += 1;
    const division: Division = {
      id: `div-${divisionCounter}`,
      label: `Divisão ${divisionCounter}`,
      x: 1 + divisionCounter * 0.5,
      y: 1 + divisionCounter * 0.5,
      width: 4,
      height: 3,
      wallHeightM: 3,
      blockSpecId: BLOCK_CATALOG[1].id,
    };
    set((state) => {
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
      materials: state.materials.map((m) =>
        m.materialId === materialId ? { ...m, userPrice: price } : m,
      ),
    }));
  },

  addCustomMaterial: () => {
    customMaterialCounter += 1;
    const item: CustomMaterialLine = {
      id: `custom-${customMaterialCounter}`,
      name: "Novo item (ex: Tinta, Gesso)",
      unit: "un",
      quantity: 1,
      price: 0,
    };
    set((state) => ({ customMaterials: [...state.customMaterials, item] }));
  },

  updateCustomMaterial: (id, patch) => {
    set((state) => ({
      customMaterials: state.customMaterials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },

  removeCustomMaterial: (id) => {
    set((state) => ({ customMaterials: state.customMaterials.filter((m) => m.id !== id) }));
  },
}));
