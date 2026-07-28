import { EffectComposer, N8AO, Bloom, Vignette, SMAA } from '@react-three/postprocessing'

// Post pipeline (order matters): ambient occlusion grounds everything first,
// then restrained bloom makes only the bright emissive sources (neon cove,
// arcade screens, monitors, robot eyes, glow decals) actually glow, then a
// gentle vignette, then SMAA for edges.
//
// Perf notes: AO runs half-res at "performance" quality (visually near-identical
// on this flat-shaded scene, several ms cheaper). The composer runs without
// MSAA (multisampling multiplies the whole frame cost) — SMAA at the end is the
// cheap replacement for edge quality.
export function Effects({ dark }: { dark: boolean }) {
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        aoRadius={0.9}
        distanceFalloff={1.0}
        intensity={dark ? 1.7 : 2.1}
        color={dark ? '#04030f' : '#241a3a'}
        quality="performance"
        halfRes
      />
      <Bloom
        intensity={dark ? 0.95 : 0.62}
        luminanceThreshold={dark ? 0.72 : 0.68}
        luminanceSmoothing={0.9}
        mipmapBlur
        radius={0.72}
      />
      <Vignette offset={0.3} darkness={dark ? 0.55 : 0.32} />
      <SMAA />
    </EffectComposer>
  )
}
