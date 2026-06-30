import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { LOW_POWER } from '../lowPower'

/**
 * Restrained post for the photoreal look: a high-threshold bloom so ONLY the
 * bright emissive sources (monitors, RGB strips, LED cove, ceiling panels)
 * glow — the lit PBR surfaces stay grounded — plus a soft vignette. Tone mapping
 * (ACES) is set on the renderer in App.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={LOW_POWER ? 2 : 4}>
      <Bloom
        mipmapBlur
        intensity={0.7}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.25}
        radius={0.6}
      />
      <Vignette offset={0.3} darkness={0.55} />
    </EffectComposer>
  )
}
