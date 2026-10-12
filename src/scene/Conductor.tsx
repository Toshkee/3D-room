import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ROAM } from '../data/roam'
import { startTalk, type Agent, type World } from './world'

// Keeps the room social between runs: now and then two bots that are both
// free (idle or just done, not selected, not walking in) meet up. One walks
// over to the other, they face each other and gesture for a few seconds.
// Pure body language: nothing is said and nothing calls Claude. A bot that
// just chatted gets a long breather so it stays an occasional thing.
const EVERY_MS = 15_000
const CHANCE = 0.4
const BREATHER = 45

export function Conductor({ world, reducedMotion }: { world: World; reducedMotion: boolean }) {
  const clock = useThree((s) => s.clock)

  useEffect(() => {
    if (reducedMotion) return
    const id = setInterval(() => {
      if (Math.random() > CHANCE) return
      const t = clock.elapsedTime
      const free = (x: Agent) =>
        (x.status === 'idle' || x.status === 'done') &&
        !x.entering &&
        !x.selected &&
        x.visit == null &&
        x.talkUntil <= t &&
        t - x.lastTalk > BREATHER
      const ids = Object.keys(world.agents).filter((k) => free(world.agents[k]))
      if (ids.length < 2) return
      const i = Math.floor(Math.random() * ids.length)
      let j = Math.floor(Math.random() * (ids.length - 1))
      if (j >= i) j++
      const visitor = ids[i]
      const host = ids[j]
      const V = world.agents[visitor]
      const H = world.agents[host]
      if (V.pos.distanceTo(H.pos) < ROAM.TALK_GAP + 0.7) {
        startTalk(world, visitor, host, t, ROAM.TALK_SECS)
        return
      }
      V.visit = host
      H.holdUntil = Math.max(H.holdUntil, t + 15)
    }, EVERY_MS)
    return () => clearInterval(id)
  }, [clock, world, reducedMotion])

  return null
}
