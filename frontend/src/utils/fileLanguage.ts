/** Map file extension → language selector value */
const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  pyw: "python",
  java: "java",
  go: "go",
  rs: "rust",
  cs: "csharp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  h: "cpp",
};

const MAX_READ_BYTES = 1024 * 1024; // 1 MB — match backend upload limit

export function languageFromFilename(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i < 0) return null;
  const ext = name.slice(i + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_READ_BYTES) {
      reject(new Error(`File is too large (max ${MAX_READ_BYTES / 1024} KB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}
