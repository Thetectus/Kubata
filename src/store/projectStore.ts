import { create } from "zustand";
import type { Division, MaterialLine, Project } from "../types/project";
import { calculateMaterials } from "../lib/materials";

interface ProjectState {
  project: Project;
  materials: MaterialLine[];
  addDivision: () => void;
  updateDivision: (id: string, patch: Partial<Division>) => void;
  removeDivision: (id: string) => void;
  setUserPrice: (materialId: string, price: number | undefined) => void;
}

function recalculate(project: Project, prevMaterials: MaterialLine[]): MaterialLine[] {
  const fresh = calculateMaterials(project.divisions);
  return fresh.map((line) => {
    const prev = prevMaterials.find((m) => m.materialId === line.materialId);
    return prev?.userPrice !== undefined ? { ...line, userPrice: prev.userPrice } : line;
  });
}

let divisionCounter = 0;

export const useProjectStore = create<ProjectState>((set) => ({
  project: {
    id: "projeto-1",
    name: "Novo projecto",
    kind: "construir",
    divisions: [],
  },
  materials: [],

  addDivision: () => {
    divisionCounter += 1;
    const division: Division = {
      id: `div-${divisionCounter}`,
      label: `Divisão ${divisionCounter}`,
      x: 1 + divisionCounter * 0.5,
      y: 1 + divisionCounter * 0.5,
      width: 4,
      height: 3,
      wallType: "bloco-cimento",
      wallHeightM: 3,
    };
    set((state) => {
      const project = { ...state.project, divisions: [...state.project.divisions, division] };
      return { project, materials: recalculate(project, state.materials) };
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
      return { project, materials: recalculate(project, state.materials) };
    });
  },

  setUserPrice: (materialId, price) => {
    set((state) => ({
      materials: state.materials.map((m) =>
        m.materialId === materialId ? { ...m, userPrice: price } : m,
      ),
    }));
  },
}));
