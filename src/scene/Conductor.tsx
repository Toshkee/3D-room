import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { sceneBus } from '../state/sceneBus'
import { ROAM } from '../data/roam'
import { startTalk, type Agent, type World } from './world'

// Turns "bot A addressed bot B in the team channel" into body language: one of
// them walks over to the other, they face each other and gesture back and
// forth for a few seconds. The free one walks (a bot typing at its desk keeps
// working and just swivels to face the visitor). Not every exchange triggers a
// visit, and a bot that just chatted gets a breather, so the room doesn't turn
// into a stampede.
export function Conductor({ world, reducedMotion }: { world: World; reducedMotion: boolean }) {
  const clock = useThree((s) => s.clock)

  useEffect(() => {
    if (reducedMotion) return
    return sceneBus.onCue((c) => {
      if (c.type !== 'converse') return
      const t = clock.elapsedTime
      const A = world.agents[c.a]
      const B = world.agents[c.b]
      if (!A || !B) return
      const busy = (x: Agent) =>
        x.entering || x.selected || x.visit != null || x.talkUntil > t || t - x.lastTalk < 8
      if (busy(A) || busy(B)) return
      if (Math.random() > 0.8) return

      const free = (x: Agent) => x.status !== 'working'
      let visitor = c.a
      let host = c.b
      if (!free(A)) {
        if (!free(B)) return
        visitor = c.b
        host = c.a
      }
      const V = world.agents[visitor]
      const H = world.agents[host]
      if (V.pos.distanceTo(H.pos) < ROAM.TALK_GAP + 0.7) {
        startTalk(world, visitor, host, t, ROAM.TALK_SECS)
        return
      }
      V.visit = host
      H.holdUntil = Math.max(H.holdUntil, t + 15)
    })
  }, [clock, world, reducedMotion])

  return null
}
