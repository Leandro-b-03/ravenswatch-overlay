// Heuristics for telling the real Ravenswatch game window apart from
// everything else that mentions "ravenswatch" (this app's own windows,
// the project folder in Explorer, browser tabs, Discord, IDEs).

// Our own window titles all start with "Ravenswatch Overlay".
export function isOwnAppWindow(name: string): boolean {
  return /^ravenswatch overlay/i.test(name.trim())
}

const NOT_THE_GAME = /overlay|explorer|panel|visual studio|code|chrome|edge|firefox|discord/i

export function looksLikeGameWindow(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n.includes('ravenswatch')) return false
  if (NOT_THE_GAME.test(n)) return false
  return true
}

// Pick the most likely game source from a list of window names.
export function pickGameSource<T extends { name: string }>(sources: T[]): T | null {
  return (
    sources.find((s) => s.name.trim().toLowerCase() === 'ravenswatch') ??
    sources.find((s) => looksLikeGameWindow(s.name)) ??
    null
  )
}
