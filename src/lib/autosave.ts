import { useProjectStore } from "../store/projectStore";
import { saveProject, setPointer } from "./projectSync";

const DEBOUNCE_MS = 600;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Guarda o projecto no Supabase pouco depois de cada alteração (debounced). */
export function startAutosave(): void {
  useProjectStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      setPointer(state.project.id);
      void saveProject({ project: state.project, materials: state.materials });
    }, DEBOUNCE_MS);
  });
}
