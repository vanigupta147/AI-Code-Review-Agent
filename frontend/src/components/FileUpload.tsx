import { useRef, type ChangeEvent } from "react";
import { languageFromFilename, readTextFile } from "../utils/fileLanguage";

interface FileUploadProps {
  onLoaded: (content: string, filename: string, detectedLanguage: string | null) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const ACCEPT =
  ".js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.pyw,.java,.go,.rs,.cs,.cpp,.cc,.cxx,.hpp,.h,.txt";

export function FileUpload({ onLoaded, onError, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const content = await readTextFile(file);
      const detected = languageFromFilename(file.name);
      onLoaded(content, file.name, detected);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not read file.");
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="file-input-hidden"
        accept={ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Upload code file"
      />
      <button
        type="button"
        className="upload-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Upload file
      </button>
    </>
  );
}
