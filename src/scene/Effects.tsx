import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

// Restrained bloom so only the bright emissive sources (neon cove, arcade
// screens, monitors, robot eyes/antenna) actually glow — the arcade mood. A
// high luminance threshold keeps the matte furniture and pastels from washing out.
export function Effects({ dark }: { dark: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={dark ? 0.95 : 0.5}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.9}
        mipmapBlur
        radius={0.7}
      />
      <Vignette offset={0.3} darkness={dark ? 0.55 : 0.32} />
    </EffectComposer>
  )
}
