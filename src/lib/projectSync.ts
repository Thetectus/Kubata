import { supabase } from "./supabase";
import type { MaterialLine, Project } from "../types/project";

export interface PersistedProject {
  project: Project;
  materials: MaterialLine[];
}

const POINTER_KEY = "kubata-current-project-id";

export function getPointer(): string | null {
  return localStorage.getItem(POINTER_KEY);
}

export function setPointer(id: string): void {
  localStorage.setItem(POINTER_KEY, id);
}

interface ProjectRow {
  id: string;
  name: string;
  kind: Project["kind"];
  data: { divisions: Project["divisions"]; freeWalls?: Project["freeWalls"]; materials: MaterialLine[] };
}

export async function loadProject(id: string): Promise<PersistedProject | null> {
  const { data, error } = await supabase.from("projects").select("id, name, kind, data").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as ProjectRow;
  const divisions = (row.data?.divisions ?? []).map((d) => ({ ...d, openings: d.openings ?? [] }));
  const freeWalls = (row.data?.freeWalls ?? []).map((w) => ({ ...w, openings: w.openings ?? [] }));
  return {
    project: { id: row.id, name: row.name, kind: row.kind, divisions, freeWalls },
    materials: row.data?.materials ?? [],
  };
}

export async function saveProject(state: PersistedProject): Promise<void> {
  const { project, materials } = state;
  const { error } = await supabase.from("projects").upsert({
    id: project.id,
    name: project.name,
    kind: project.kind,
    data: { divisions: project.divisions, freeWalls: project.freeWalls, materials },
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("Falha ao guardar projecto no Supabase:", error.message);
}
