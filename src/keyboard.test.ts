import { describe, expect, it } from "vitest";
import { renameCharacter } from "./keyboard";

const key = (value: string, modifiers = {}) =>
  renameCharacter({
    key: value,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...modifiers,
  });
describe("digitar para renomear", () => {
  it("preserva o primeiro caractere, inclusive F, números e letras acentuadas", () => {
    for (const text of ["a", "F", "9", "é", "Σ", "_"])
      expect(key(text)).toBe(text);
  });
  it("preserva atalhos Ctrl, Cmd e Alt", () => {
    expect(key("z", { ctrlKey: true })).toBeNull();
    expect(key("a", { metaKey: true })).toBeNull();
    expect(key("f", { altKey: true })).toBeNull();
  });
  it("ignora navegação, espaços e composição ainda incompleta", () => {
    for (const text of [
      " ",
      "Enter",
      "Escape",
      "Tab",
      "Delete",
      "Backspace",
      "ArrowLeft",
      "Dead",
      "Process",
    ])
      expect(key(text)).toBeNull();
    expect(key("a", { isComposing: true })).toBeNull();
  });
});
