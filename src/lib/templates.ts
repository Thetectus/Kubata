import type { Division, Project } from "../types/project";
import { BLOCK_CATALOG } from "./blocks";

type DivisionTemplate = Omit<Division, "id" | "openings"> & { openings?: Omit<Division["openings"][number], "id">[] };

export interface ProjectTemplate {
  id: string;
  label: string;
  kind: Project["kind"];
  divisions: DivisionTemplate[];
}

const BLOCO = BLOCK_CATALOG.find((b) => b.id === "bloco-14x19x39")!.id;

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "vazio",
    label: "Projecto vazio",
    kind: "construir",
    divisions: [],
  },
  {
    id: "quarto-simples",
    label: "Quarto simples",
    kind: "construir",
    divisions: [
      {
        label: "Quarto",
        x: 1,
        y: 1,
        width: 4,
        height: 3.5,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [
          { side: "bottom", type: "porta", offsetM: 0.3, widthM: 0.9 },
          { side: "top", type: "janela", offsetM: 1.5, widthM: 1.2 },
        ],
      },
    ],
  },
  {
    id: "casa-banho",
    label: "Casa de banho",
    kind: "construir",
    divisions: [
      {
        label: "Casa de banho",
        x: 1,
        y: 1,
        width: 2,
        height: 2,
        wallHeightM: 2.6,
        blockSpecId: BLOCO,
        openings: [{ side: "bottom", type: "porta", offsetM: 0.2, widthM: 0.7 }],
      },
    ],
  },
  {
    id: "t3-tipica",
    label: "T3 típica (sala, cozinha, 3 quartos, wc)",
    kind: "construir",
    divisions: [
      {
        label: "Sala",
        x: 1,
        y: 1,
        width: 5,
        height: 4,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [
          { side: "bottom", type: "porta", offsetM: 2, widthM: 1 },
          { side: "top", type: "janela", offsetM: 1, widthM: 2 },
        ],
      },
      {
        label: "Cozinha",
        x: 6.5,
        y: 1,
        width: 3,
        height: 3,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [{ side: "top", type: "janela", offsetM: 1, widthM: 1.2 }],
      },
      {
        label: "Quarto 1",
        x: 1,
        y: 5.5,
        width: 3.5,
        height: 3.5,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [{ side: "bottom", type: "porta", offsetM: 0.3, widthM: 0.9 }],
      },
      {
        label: "Quarto 2",
        x: 5,
        y: 5.5,
        width: 3.5,
        height: 3.5,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [{ side: "bottom", type: "porta", offsetM: 0.3, widthM: 0.9 }],
      },
      {
        label: "Quarto 3 (suite)",
        x: 9,
        y: 5.5,
        width: 3.8,
        height: 3.5,
        wallHeightM: 3,
        blockSpecId: BLOCO,
        openings: [{ side: "bottom", type: "porta", offsetM: 0.3, widthM: 0.9 }],
      },
      {
        label: "WC social",
        x: 6.5, y: 4.5, width: 2, height: 2, wallHeightM: 3, blockSpecId: BLOCO,
        openings: [{ side: "bottom", type: "porta", offsetM: 0.2, widthM: 0.7 }],
      },
    ],
  },
];

export function instantiateTemplate(template: ProjectTemplate): Project {
  return {
    id: crypto.randomUUID(),
    name: template.label,
    kind: template.kind,
    divisions: template.divisions.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
      openings: (d.openings ?? []).map((o) => ({ ...o, id: crypto.randomUUID() })),
    })),
  };
}
