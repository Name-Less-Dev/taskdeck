import { useId } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { DEFAULT_THEME, THEMES, type ResolvedTheme, type Theme } from '../ui/theme.ts'
import form from './Form.module.css'
import styles from './SettingsSheet.module.css'

export interface ThemePickerProps {
  readonly theme: Theme
  readonly onChange: (theme: Theme) => void
}

/**
 * Settings > Appearance: one radio per theme, each with a 3-colour swatch
 * (background, surface, accent) painted by the theme's own tokens (a nested
 * data-theme) and its name as text. Native radios: arrow keys move and
 * apply, focus is visible. "Restore default" goes back to auto.
 */
export function ThemePicker({ theme, onChange }: ThemePickerProps) {
  const { t } = useI18n()
  const id = useId()

  return (
    <fieldset className={styles.section}>
      <legend className={styles.heading}>{t.appearance.heading}</legend>
      <div className={styles.themes}>
        {THEMES.map((option) => (
          <label key={option} className={styles.themeOption} data-testid={`theme-${option}`}>
            <input
              type="radio"
              name={`${id}-theme`}
              value={option}
              checked={theme === option}
              onChange={() => {
                onChange(option)
              }}
            />
            {option === 'auto' ? (
              <span className={styles.swatchPair} aria-hidden="true">
                <Swatch theme="light" />
                <Swatch theme="dark" />
              </span>
            ) : (
              <Swatch theme={option} />
            )}
            <span className={styles.themeName}>{t.appearance.themes[option]}</span>
          </label>
        ))}
      </div>
      <p className={form.hint}>{t.appearance.autoHint}</p>
      <button
        type="button"
        className={form.secondary}
        disabled={theme === DEFAULT_THEME}
        onClick={() => {
          onChange(DEFAULT_THEME)
        }}
      >
        {t.appearance.reset}
      </button>
    </fieldset>
  )
}

function Swatch({ theme }: { theme: ResolvedTheme }) {
  return (
    <span className={styles.swatch} data-theme={theme} aria-hidden="true">
      <span className={styles.swatchBg} />
      <span className={styles.swatchSurface} />
      <span className={styles.swatchAccent} />
    </span>
  )
}
