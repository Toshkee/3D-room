// Last step of `npm run app`: copies the freshly built AI Lounge.app into
// /Applications (replacing the previous build), ad-hoc signed so macOS runs it.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const NAME = 'AI Lounge.app'
const TARGET = path.join('/Applications', NAME)
const release = path.resolve('release')
const built = fs
  .readdirSync(release)
  .filter((d) => d.startsWith('mac'))
  .map((d) => path.join(release, d, NAME))
  .find((p) => fs.existsSync(p))
if (!built) {
  console.error(`No ${NAME} in release/ — did electron-builder fail?`)
  process.exit(1)
}

const running = (() => {
  try {
    execFileSync('pgrep', ['-f', `${TARGET}/Contents/MacOS/`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()
if (running) {
  console.error('AI Lounge is open — quit it (Cmd+Q), then run `npm run app` again.')
  process.exit(1)
}

// Apple silicon refuses to launch unsigned code; a local ad-hoc signature is enough on this Mac.
try {
  execFileSync('codesign', ['--verify', '--deep', built], { stdio: 'ignore' })
} catch {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', built], { stdio: 'inherit' })
}

fs.rmSync(TARGET, { recursive: true, force: true })
execFileSync('ditto', [built, TARGET])
console.log(`Installed ${TARGET} — open "AI Lounge" from Launchpad, Spotlight or the Dock.`)
