import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, Trash2, ArrowRightToLine } from "lucide-react";
import { normalizeStateLabel, uppercaseStateInput } from "../stateLabel";

export function StateContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
  onSetInitial,
  isInitial = false,
  label = "Opções do estado",
  editLabel = "Renomear",
}: {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSetInitial?: () => void;
  isInitial?: boolean;
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
      className={`state-context-menu${onSetInitial ? " state-menu" : ""}`}
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
          const buttons = Array.from(
            ref.current!.querySelectorAll("button"),
          ).filter((button) => !button.disabled);
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
      {onSetInitial && (
        <button role="menuitem" disabled={isInitial} onClick={onSetInitial}>
          <ArrowRightToLine size={16} />
          {isInitial ? "Estado inicial" : "Definir como estado inicial"}
        </button>
      )}
    </div>
  );
}

export function StateNameInput({
  name,
  initialText,
  onConfirm,
  onCancel,
}: {
  name: string;
  initialText?: string;
  onConfirm: (name: string, viaBlur: boolean) => void;
  onCancel: (viaBlur: boolean) => void;
}) {
  const [value, setValue] = useState(() =>
    normalizeStateLabel(initialText ?? name),
  );
  const input = useRef<HTMLInputElement>(null),
    done = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
    if (initialText === undefined) input.current?.select();
    else input.current?.setSelectionRange(value.length, value.length);
  }, []);
  const save = (viaBlur = false) => {
    if (done.current) return;
    done.current = true;
    if (value.trim()) onConfirm(value.trim(), viaBlur);
    else onCancel(viaBlur);
  };
  return (
    <div
      className="state-name-editor"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        ref={input}
        aria-label="Nome do estado"
        value={value}
        style={{ width: `${Math.max(2, Array.from(value).length) + 0.5}ch` }}
        maxLength={30}
        onChange={(e) => {
          setValue(
            (e.nativeEvent as InputEvent).isComposing
              ? e.target.value
              : uppercaseStateInput(e.currentTarget),
          );
        }}
        onCompositionEnd={(e) => setValue(uppercaseStateInput(e.currentTarget))}
        onBlur={() => save(true)}
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
            onCancel(false);
          }
        }}
      />
    </div>
  );
}
