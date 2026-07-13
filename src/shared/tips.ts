// Turns a build's player-written guide (BuildMaker description HTML) and the
// user's own notes into short plain-text tips for the overlay.

const BLOCK_END = /<\/(p|h[1-6]|li|div)>/gi
const TAGS = /<[^>]+>/g

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' '
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}

export function buildTips(descriptionHtml?: string, notes?: string): string[] {
  const tips: string[] = []
  if (descriptionHtml) {
    const text = decodeEntities(descriptionHtml.replace(BLOCK_END, '\n').replace(TAGS, ''))
    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/\s+/g, ' ').trim()
      // Skip headings-turned-fragments and noise; keep substantive lines.
      if (line.length < 12) continue
      tips.push(line)
    }
  }
  if (notes) {
    for (const rawLine of notes.split('\n')) {
      const line = rawLine.trim()
      if (line.length > 0) tips.push(line)
    }
  }
  // Guard against pathological guides: overlay cycles a bounded list.
  return tips.slice(0, 60)
}
