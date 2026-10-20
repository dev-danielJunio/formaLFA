// Keep the saved label within the JSON format's 30 UTF-16 unit limit, even
// when uppercasing expands a character (e.g. ß → SS).
export function normalizeStateLabel(value: string): string {
  let result = "";
  for (const char of value.toUpperCase()) {
    if (result.length + char.length > 30) break;
    result += char;
  }
  return result;
}

export function uppercaseStateInput(input: HTMLInputElement): string {
  const raw = input.value;
  const start = normalizeStateLabel(
    raw.slice(0, input.selectionStart ?? raw.length),
  ).length;
  const end = normalizeStateLabel(
    raw.slice(0, input.selectionEnd ?? raw.length),
  ).length;
  input.value = normalizeStateLabel(raw);
  input.setSelectionRange(start, end);
  return input.value;
}
