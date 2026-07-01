import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'

// Post pipeline (order matters): ambient occlusion grounds everything first,
// then restrained bloom makes only the bright emissive sources (neon cove,
// arcade screens, monitors, robot eyes, glow decals) actually glow, then a
// gentle vignette. No bloom threshold change to the matte pastels — they stay flat.
export function Effects({ dark }: { dark: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      {/* Soft, tinted ambient occlusion — nestles objects into the room and
          darkens seams/corners. Half-res + medium quality keeps it cheap. */}
      <N8AO
        aoRadius={0.9}
        distanceFalloff={1.0}
        intensity={dark ? 1.7 : 2.1}
        color={dark ? '#04030f' : '#241a3a'}
        quality="high"
      />
      <Bloom
        intensity={dark ? 0.95 : 0.62}
        luminanceThreshold={dark ? 0.72 : 0.68}
        luminanceSmoothing={0.9}
        mipmapBlur
        radius={0.72}
      />
      <Vignette offset={0.3} darkness={dark ? 0.55 : 0.32} />
    </EffectComposer>
  )
}
