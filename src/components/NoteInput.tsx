import { useLayoutEffect, useRef, useState } from "react";
import { noteLayout } from "../noteLayout";

export function NoteInput({
  text,
  onConfirm,
  onCancel,
  left,
  top,
  scale,
}: {
  text: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  left: number;
  top: number;
  scale: number;
}) {
  const [value, setValue] = useState(text);
  const input = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  const save = () => {
    if (done.current) return;
    done.current = true;
    onConfirm(value);
  };
  return (
    <textarea
      ref={input}
      className="note-typography note-editor"
      style={{ left, top, transform: `scale(${scale})`, ...noteLayout(value) }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      aria-label="Texto da anotação"
      value={value}
      maxLength={4000}
      wrap="off"
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          save();
        }
      }}
    />
  );
}
