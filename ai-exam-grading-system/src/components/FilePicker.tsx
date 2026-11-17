"use client";

import { useId, useRef, useState } from "react";

interface Props {
  accept: string;
  title: string;
  hint: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

export default function FilePicker({ accept, title, hint, disabled, onFiles }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const list = Array.from(e.dataTransfer.files);
        if (list.length) onFiles(list);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:border-ink ${
        over ? "border-ink bg-wash" : "border-line bg-card hover:border-muted"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-3 text-muted">
        <path
          d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-medium">{title}</span>
      <span className="mt-1 text-sm text-muted">{hint}</span>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length) onFiles(list);
          if (input.current) input.current.value = "";
        }}
      />
    </label>
  );
}
