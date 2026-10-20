import type { Nozzle, NozzleLibrary, NozzleLibraryFile } from "./types";

export function serializeNozzles(lib: NozzleLibrary): string {
  const file: NozzleLibraryFile = { format: "arcflow-nozzles", version: 1, library: lib };
  return JSON.stringify(file, null, 2);
}

export function parseNozzles(text: string): NozzleLibrary {
  const raw = JSON.parse(text) as Partial<NozzleLibraryFile>;
  if (raw.format !== "arcflow-nozzles") throw new Error("Not an arcflow nozzle library file");
  if (raw.version !== 1) throw new Error(`Unsupported nozzle library version ${String(raw.version)}`);
  const lib = raw.library;
  if (!lib || typeof lib.id !== "string" || !Array.isArray(lib.nozzles)) throw new Error("Missing library body");
  return { id: lib.id, nozzles: lib.nozzles.map((n, i) => validateNozzle(n, i)) };
}

function validateNozzle(n: unknown, i: number): Nozzle {
  if (!n || typeof n !== "object") throw new Error(`Nozzle ${i} is not an object`);
  const r = n as Record<string, unknown>;
  const need = (k: string, t: "string" | "number"): string | number => {
    const v = r[k];
    if (typeof v !== t) throw new Error(`Nozzle ${i} field "${k}" must be ${t}`);
    return v as string | number;
  };
  const out: Nozzle = {
    id: need("id", "string") as string,
    label: need("label", "string") as string,
    diameterMm: need("diameterMm", "number") as number,
    defaultKerfMm: need("defaultKerfMm", "number") as number,
  };
  if (typeof r.note === "string") out.note = r.note;
  if (r.currentBand && typeof r.currentBand === "object") {
    const cb = r.currentBand as Record<string, unknown>;
    if (typeof cb.minA === "number" && typeof cb.maxA === "number") {
      out.currentBand = { minA: cb.minA, maxA: cb.maxA };
    }
  }
  return out;
}
