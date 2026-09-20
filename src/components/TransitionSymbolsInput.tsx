import { useLayoutEffect, useId, useRef, useState } from "react";
import type { Automaton } from "../model";
import { parseSymbols } from "../symbols";

export function TransitionSymbolsInput({
  initialValue,
  mode,
  inline = false,
  onConfirm,
  onCancel,
}: {
  initialValue: string;
  mode: Automaton["mode"];
  inline?: boolean;
  onConfirm: (symbols: string[]) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const completed = useRef(false);
  const errorId = useId();
  useLayoutEffect(() => {
    if (!inline) return;
    // The pointer-up handler releases capture before React commits this input.
    // Focus synchronously; animation frames can be throttled in background tabs.
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, [inline]);
  const cancel = () => {
    if (completed.current) return;
    if (!inline) {
      setValue(initialValue);
      setError("");
      onCancel();
      return;
    }
    completed.current = true;
    onCancel();
  };
  const save = () => {
    if (completed.current) return;
    if (!value.trim() && inline) {
      cancel();
      return;
    }
    try {
      const symbols = parseSymbols(value, mode);
      completed.current = true;
      onConfirm(symbols);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div
      className={inline ? "inline-symbol-editor" : "symbol-editor"}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        ref={input}
        id={inline ? undefined : "edge-symbols"}
        type="text"
        inputMode="text"
        aria-label="Símbolos da transição"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="0, 1"
        maxLength={100}
        value={value}
        onChange={(e) => {
          completed.current = false;
          setValue(e.target.value);
          setError("");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
      {error && (
        <p id={errorId} className="symbol-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
