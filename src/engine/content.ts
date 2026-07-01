import type { ActivityLine, Role } from '../types'

// Deterministic-enough randomness helpers. (Math.random is fine in app code.)
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
export function chance(p: number): boolean {
  return Math.random() < p
}

type ActKind = ActivityLine['kind']
type Line = { text: string; kind: ActKind }

// ---------------------------------------------------------------------------
// Tasks a bot rotates through. When one finishes, the sim picks a new one.
// ---------------------------------------------------------------------------
export const TASKS: Record<Role, string[]> = {
  engineer: [
    'Refactoring the auth service',
    'Fixing the flaky checkout test',
    'Wiring up the websocket layer',
    'Optimizing the query planner',
    'Migrating to the new API client',
  ],
  researcher: [
    'Surveying vector search options',
    'Comparing rerankers on our set',
    'Reading up on RAG evals',
    'Benchmarking embedding models',
    'Digging into the latency spikes',
  ],
  designer: [
    'Polishing the design system',
    'Reworking the onboarding flow',
    'Auditing color contrast',
    'Prototyping the empty states',
    'Tightening the mobile layout',
  ],
  writer: [
    'Drafting the launch post',
    'Editing the docs intro',
    'Writing release notes',
    'Rewriting the pricing page',
    'Outlining the case study',
  ],
  analyst: [
    'Analyzing the Q3 funnel',
    'Modeling churn cohorts',
    'Building the retention dashboard',
    'Chasing an anomaly in signups',
    'Sizing the activation lift',
  ],
  coordinator: [
    'Planning the next sprint',
    'Unblocking the release',
    'Syncing the roadmap',
    'Grooming the backlog',
    'Prepping the demo',
  ],
}

// ---------------------------------------------------------------------------
// Activity-feed lines — the granular steps you watch scroll by per bot.
// ---------------------------------------------------------------------------
export const ACTIVITY: Record<Role, Line[]> = {
  engineer: [
    { text: 'Reading through the module…', kind: 'thought' },
    { text: 'Sketching the interface first', kind: 'action' },
    { text: 'git checkout -b fix/auth-refresh', kind: 'action' },
    { text: 'Running the test suite…', kind: 'action' },
    { text: '✓ 214 passed, 0 failed', kind: 'result' },
    { text: 'Found a race condition in the scheduler', kind: 'result' },
    { text: 'Refactoring the retry logic', kind: 'action' },
    { text: 'Hmm, this allocation looks hot', kind: 'thought' },
    { text: 'Pushed a fix, opening a PR', kind: 'result' },
    { text: 'Types check clean ✓', kind: 'result' },
  ],
  researcher: [
    { text: 'Pulling the latest papers…', kind: 'action' },
    { text: 'Skimming 12 sources', kind: 'action' },
    { text: 'This benchmark disagrees with the last one', kind: 'thought' },
    { text: 'Reranking beats naive top-k here', kind: 'result' },
    { text: 'Noting the trade-offs', kind: 'action' },
    { text: 'Cross-checking the numbers', kind: 'thought' },
    { text: 'Drafting a short summary', kind: 'action' },
    { text: 'Conclusion: hybrid search wins', kind: 'result' },
    { text: 'Flagging two claims to verify', kind: 'result' },
  ],
  designer: [
    { text: 'Opening the component library', kind: 'action' },
    { text: 'These spacings feel off', kind: 'thought' },
    { text: 'Trying an 8px baseline grid', kind: 'action' },
    { text: 'Contrast is failing on the pills', kind: 'result' },
    { text: 'Nudging the accent a shade darker', kind: 'action' },
    { text: 'Much cleaner now ✓', kind: 'result' },
    { text: 'Exporting new tokens', kind: 'action' },
    { text: 'Mocking the empty state', kind: 'action' },
    { text: 'That hover feels delightful', kind: 'thought' },
  ],
  writer: [
    { text: 'Outlining the sections', kind: 'action' },
    { text: 'The intro is burying the lede', kind: 'thought' },
    { text: 'Rewriting the opening line', kind: 'action' },
    { text: 'Cutting 80 words of fluff', kind: 'action' },
    { text: 'Tightened the CTA ✓', kind: 'result' },
    { text: 'Reading it out loud', kind: 'thought' },
    { text: 'Adding a concrete example', kind: 'action' },
    { text: 'Draft is ready for review', kind: 'result' },
  ],
  analyst: [
    { text: 'Loading the events table…', kind: 'action' },
    { text: 'Signups up 6% week over week', kind: 'result' },
    { text: 'Wait, this cohort looks weird', kind: 'thought' },
    { text: 'Segmenting by channel', kind: 'action' },
    { text: 'Paid is dragging activation down', kind: 'result' },
    { text: 'Rebuilding the funnel chart', kind: 'action' },
    { text: 'Double-checking the join', kind: 'thought' },
    { text: 'Insight: onboarding drop at step 3', kind: 'result' },
  ],
  coordinator: [
    { text: 'Reviewing the board', kind: 'action' },
    { text: 'Two tickets are blocked', kind: 'thought' },
    { text: 'Pinging the engineer about the API', kind: 'action' },
    { text: 'Reordering the sprint', kind: 'action' },
    { text: 'Scope looks realistic now ✓', kind: 'result' },
    { text: 'Booking the demo slot', kind: 'action' },
    { text: 'Everyone is unblocked', kind: 'result' },
  ],
}

// ---------------------------------------------------------------------------
// 1:1 chat — how a bot replies to the user. {kw} is filled with a keyword
// lifted from the user's message when there is one.
// ---------------------------------------------------------------------------
export const REPLY: Record<Role, string[]> = {
  engineer: [
    "On it. I'll start with {kw} and get you a small PR to look at.",
    'Good call on {kw} — let me check the edge cases and report back.',
    "I can wire that up. Want tests around {kw} too, or keep it lean for now?",
    "Looking at {kw} now. There's a cleaner way to do this, give me a sec.",
  ],
  researcher: [
    "Let me dig into {kw} and pull the best sources for you.",
    "Good question. Early read on {kw}: it's a trade-off, I'll quantify it.",
    "I'll compare a few options for {kw} and summarize the trade-offs.",
    'I found conflicting claims about {kw} — verifying before I answer.',
  ],
  designer: [
    "I can mock up {kw} — want a couple of directions to choose from?",
    'For {kw}, I’d lean simpler. Let me sketch it and share.',
    'Noted on {kw}. I’ll keep it on-grid and accessible.',
    "Give me a moment — I'll prototype {kw} and drop a preview.",
  ],
  writer: [
    "Happy to draft {kw}. What tone — punchy or measured?",
    "I'll take a pass at {kw} and tighten it up.",
    'On {kw} now. I’ll cut the fluff and keep the point up front.',
    'Got it. First draft of {kw} coming shortly.',
  ],
  analyst: [
    "Let me pull the numbers on {kw} and see what they say.",
    'For {kw}, I’ll segment it before drawing conclusions.',
    'Interesting — {kw} might explain the dip. Checking now.',
    "I'll build a quick view of {kw} so we can both see it.",
  ],
  coordinator: [
    "I'll line up {kw} and make sure nobody's blocked.",
    'On it — I’ll sync the team on {kw} and report back.',
    "Let me sequence {kw} against the rest of the sprint.",
    "Good priority. I'll get {kw} on the board today.",
  ],
}

// Fallback replies when the user message has no useful keyword.
export const REPLY_GENERIC = [
  'Got it — let me take a look and get back to you.',
  'On it. Give me a moment to work through this.',
  'Makes sense. I’ll dig in and report back shortly.',
  'Sure thing. Starting on that now.',
]

// ---------------------------------------------------------------------------
// Group chat — bots talking to each other. {other} is replaced with another
// bot's name. Lines are loosely role-aware so the room feels like a team.
// ---------------------------------------------------------------------------
export const GROUP: { role?: Role; text: string; mentions?: boolean }[] = [
  { role: 'coordinator', text: 'Standup: what’s everyone blocked on?', },
  { role: 'coordinator', text: '@{other} how’s your piece tracking for the demo?', mentions: true },
  { role: 'engineer', text: '@{other} can you send the numbers before I wire this up?', mentions: true },
  { role: 'engineer', text: 'Heads up: I’m touching the auth layer, expect a merge conflict.' },
  { role: 'researcher', text: '@{other} I’d go with hybrid search — the recall is worth it.', mentions: true },
  { role: 'researcher', text: 'Shared my findings in the doc, tl;dr: rerank, then cache.' },
  { role: 'designer', text: '@{other} the new spacing tokens are in, let me know if they break anything.', mentions: true },
  { role: 'designer', text: 'Pushed the empty states — feedback welcome.' },
  { role: 'writer', text: 'Draft of the post is up. @{other} can you fact-check the metrics?', mentions: true },
  { role: 'writer', text: 'What do we call this feature? Naming is hard.' },
  { role: 'analyst', text: 'Data says step 3 of onboarding is where we lose people.' },
  { role: 'analyst', text: '@{other} that ties into your redesign — worth prioritizing.', mentions: true },
  { role: 'coordinator', text: 'Nice. I’ll reshuffle the sprint so this lands first.' },
  { text: 'Agreed 👍' },
  { text: 'Makes sense to me.' },
  { text: 'I’ll pick that up after this task.' },
]

// How a bot reacts when the human posts in the group channel.
export const GROUP_TO_USER = [
  'Good point — I’ll factor that in.',
  'On it. I’ll take that side of it.',
  'Agreed. Want me to start now?',
  'Makes sense. I’ll sync with the others on it.',
  'Noted — I’ll get you an update shortly.',
]

// Lift a keyword from the user's message to weave into a reply.
export function keyword(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
  return words.length ? words[words.length - 1] : null
}
const STOP = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'your',
  'they',
  'them',
  'what',
  'when',
  'please',
  'could',
  'would',
  'should',
  'about',
  'there',
  'their',
  'want',
  'need',
  'make',
  'like',
  'just',
  'help',
  'know',
])
