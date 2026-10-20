// Parse only when committing: a comma is an ordinary character while typing.
export function parseSymbols(value: string): string[] {
  const parts = value.split(",").map((symbol) => symbol.trim());
  if (!parts.length || parts.some((symbol) => !symbol))
    throw new Error("Digite um símbolo depois de cada vírgula. Ex.: 0,1");
  if (parts.some((symbol) => Array.from(symbol).length !== 1))
    throw new Error("Separe cada símbolo por vírgula. Ex.: a,b");
  return [...new Set(parts)];
}
