export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'agentworth-theme'

/** Read the stored choice. Storage can throw in a private window — never let it break the app. */
export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* nothing to do — the choice still applies for this page */
  }
}

/** True when the page is currently rendering dark, whichever route got it there. */
export function isDark(choice: ThemeChoice): boolean {
  if (choice === 'dark') return true
  if (choice === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}
