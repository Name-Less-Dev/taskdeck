import { useState } from 'react'
import App from './App.tsx'
import { createDemoTasks } from './demo/seed.ts'

/**
 * Builds the demo deck during render (not in main.tsx) so that a failure
 * there reaches the root ErrorBoundary instead of leaving a blank page.
 */
export function Root() {
  const [tasks] = useState(() => createDemoTasks(new Date()))
  return <App initialTasks={tasks} />
}
