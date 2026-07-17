export function suggestNextNumber(existingNumbers: { number: string }[], docType: "BC" | "BR", year: number): string {
  const pattern = new RegExp(`^${docType}-(\\d+)/${year}$`)
  let max = 0
  for (const doc of existingNumbers) {
    const m = doc.number.match(pattern)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const next = String(max + 1).padStart(3, "0")
  return `${docType}-${next}/${year}`
}
