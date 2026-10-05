// Runs once in the main Vitest process before the test workers start, so the
// workers inherit the time zone. CI overrides it to exercise other zones.
export default function setup(): void {
  process.env.TZ ??= 'America/Sao_Paulo'
}
