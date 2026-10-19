/**
 * File I/O shim. In Tauri we use the native dialogs + fs plugin; in the
 * browser (pnpm dev without Tauri) we fall back to downloads/file inputs.
 * ArcFlow never talks to the machine directly — it only writes files
 * (design L2).
 */
const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FileFilter {
  name: string;
  extensions: string[];
}

export async function saveTextFile(defaultName: string, text: string, filters?: FileFilter[]): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: defaultName, filters: filters ?? [{ name: "G-code", extensions: ["nc", "txt", "tap"] }] });
    if (!path) return null;
    await writeTextFile(path, text);
    return path;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return defaultName;
}

export interface OpenedFile {
  name: string;
  text: string;
  /** Absolute path in Tauri; equal to `name` in the browser. */
  path: string;
}

export async function openTextFile(filters: FileFilter[]): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters });
    if (!path || typeof path !== "string") return null;
    const text = await readTextFile(path);
    const name = path.split(/[\\/]/).pop() ?? path;
    return { name, text, path };
  }
  return pickBrowser(filters, false).then((xs) => xs[0] ?? null);
}

export async function openTextFiles(filters: FileFilter[]): Promise<OpenedFile[]> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const picked = await open({ multiple: true, filters });
    if (!picked) return [];
    const paths = Array.isArray(picked) ? picked : [picked];
    return Promise.all(
      paths
        .filter((p): p is string => typeof p === "string")
        .map(async (p) => ({ name: p.split(/[\\/]/).pop() ?? p, text: await readTextFile(p), path: p })),
    );
  }
  return pickBrowser(filters, true);
}

function pickBrowser(filters: FileFilter[], multiple: boolean): Promise<OpenedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => "." + e)).join(",");
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text(), path: f.name }))));
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}
