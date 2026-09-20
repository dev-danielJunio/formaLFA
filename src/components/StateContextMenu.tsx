import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

export function StateContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
  label = "Opções do estado",
  editLabel = "Renomear",
}: {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  label?: string;
  editLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="state-context-menu"
      role="menu"
      aria-label={label}
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onDelete();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const buttons = Array.from(ref.current!.querySelectorAll("button"));
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (current + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) %
              buttons.length
          ].focus();
        }
      }}
    >
      <button role="menuitem" onClick={onRename}>
        <Pencil size={16} />
        {editLabel}
      </button>
      <button role="menuitem" className="delete-state" onClick={onDelete}>
        <Trash2 size={16} />
        Excluir
      </button>
    </div>
  );
}

export function StateNameInput({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name),
    [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    done = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  const save = () => {
    if (done.current) return;
    if (!value.trim()) {
      setError(true);
      return;
    }
    done.current = true;
    onConfirm(value.trim());
  };
  return (
    <div
      className="inline-symbol-editor"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        ref={input}
        aria-label="Nome do estado"
        aria-invalid={error}
        value={value}
        maxLength={30}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
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
            done.current = true;
            onCancel();
          }
        }}
      />
      {error && (
        <p className="symbol-error" role="alert">
          Digite um nome.
        </p>
      )}
    </div>
  );
}
