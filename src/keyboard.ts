// Only printable characters start a replacement; shortcuts and IME setup stay intact.
export function renameCharacter(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
    return null;
  return Array.from(event.key).length === 1 && event.key.trim()
    ? event.key
    : null;
}
