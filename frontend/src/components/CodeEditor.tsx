import type { ChangeEvent } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  placeholder = "Paste or type your code here...",
  disabled,
}: CodeEditorProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      className="code-editor"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={false}
      aria-label="Code input"
    />
  );
}
