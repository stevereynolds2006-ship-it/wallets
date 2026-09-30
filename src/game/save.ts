export type Save = {
  v: 1
  bestScore: number
  bestNet: number
  lifetimeBurns: number
  lifetimeNet: number
  runs: number
  muted: boolean
  reduced: boolean | null
}

export const SAVE_KEY = "wallets-dive-v1"

export const defaultSave = (): Save => ({
  v: 1,
  bestScore: 0,
  bestNet: 0,
  lifetimeBurns: 0,
  lifetimeNet: 0,
  runs: 0,
  muted: false,
  reduced: null,
})

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as Partial<Save>
    if (parsed.v !== 1) return defaultSave()
    return { ...defaultSave(), ...parsed, v: 1 }
  } catch {
    return defaultSave()
  }
}

export function writeSave(save: Save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}
