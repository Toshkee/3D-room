import type { Bot, Role } from '../types'

// Starter prompts — the ai-wayfinders "Suggestions" pattern. Three clickable
// prompts shown on an empty chat so the user never faces a blank slate; clicking
// one sends it immediately (no dialog). Contextual to the bot's role so the
// suggestion models a good, relevant thing to ask.
const ROLE_STARTERS: Record<Role, string[]> = {
  engineer: ['What are you building right now?', 'Any blockers on the code?', 'What did you just ship?'],
  researcher: ['What have you found so far?', 'Summarize your top sources', 'What are the trade-offs?'],
  designer: ['What are you polishing?', 'Walk me through a design choice', 'What needs my review?'],
  writer: ['What are you drafting?', 'Read me the opening line', "What's the angle?"],
  analyst: ['What is the data telling you?', 'Where is the signal?', 'Summarize the numbers'],
  coordinator: ["What's blocking the team?", "Summarize today's progress", 'Who needs help?'],
}

export function botStarters(bot: Pick<Bot, 'role'>): string[] {
  return ROLE_STARTERS[bot.role]
}

export const TEAM_STARTERS = [
  "What's everyone working on?",
  'Any blockers to raise?',
  "What's the plan for today?",
]
