import { sceneBus, type Cue } from '../state/sceneBus'

// ---------------------------------------------------------------------------
// The lounge's sound layer — entirely synthesized with Web Audio (no assets),
// OFF until the user turns it on from the top bar:
//   • a soft lo-fi bed: slow jazzy 7th chords through a warm low-pass, a quiet
//     sub, and faint vinyl crackle
//   • gentle keyboard clatter while bots are typing at desks/laptops
//   • a two-note chime when a bot finishes a task
//   • a tiny "blip" when a bot speaks (rate-limited)
// Everything runs through one master gain so toggling fades in/out cleanly.
// ---------------------------------------------------------------------------

// Fmaj7 → Em7 → Dm7 → Cmaj7 (Hz), voiced low and close.
const CHORDS = [
  [174.61, 220.0, 261.63, 329.63],
  [164.81, 196.0, 246.94, 293.66],
  [146.83, 174.61, 220.0, 261.63],
  [130.81, 164.81, 196.0, 246.94],
]
const CHORD_SECS = 4.8

class LoungeAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bed: GainNode | null = null
  private sfx: GainNode | null = null
  private enabled = false
  private unsubs: (() => void)[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private nextChordAt = 0
  private chordIx = 0
  private keys = 0
  private lastBlip = 0
  private crackle: AudioBufferSourceNode | null = null
  private unlock = () => {
    void this.ctx?.resume()
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return
    this.enabled = on
    if (on) this.start()
    else this.stop()
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.bed = ctx.createGain()
    this.bed.gain.value = 0.55
    this.bed.connect(this.master)
    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.9
    this.sfx.connect(this.master)
    return ctx
  }

  private start() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    // Browsers keep audio suspended until a user gesture — resume on the next one.
    if (ctx.state === 'suspended') {
      void ctx.resume()
      window.addEventListener('pointerdown', this.unlock, { once: true })
      window.addEventListener('keydown', this.unlock, { once: true })
    }
    const now = ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0.85, now + 1.2)
    this.nextChordAt = now + 0.1
    this.scheduleBed()
    this.startCrackle()
    this.unsubs.push(sceneBus.onCue((c) => this.onCue(c)))
    this.unsubs.push(
      sceneBus.onKeys((n) => {
        const was = this.keys
        this.keys = n
        if (!was && n) this.typeBurst()
      }),
    )
  }

  private stop() {
    const ctx = this.ctx
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.keys = 0
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0, now + 0.5)
    this.timers.push(
      setTimeout(() => {
        if (this.enabled) return
        try {
          this.crackle?.stop()
        } catch {
          /* already stopped */
        }
        this.crackle = null
        void ctx.suspend()
      }, 600),
    )
  }

  private later(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== id)
      fn()
    }, ms)
    this.timers.push(id)
  }

  // --- lo-fi bed ---------------------------------------------------------------
  private scheduleBed() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    while (this.nextChordAt < ctx.currentTime + 2.5) {
      this.chord(CHORDS[this.chordIx % CHORDS.length], this.nextChordAt)
      this.chordIx += 1
      this.nextChordAt += CHORD_SECS
    }
    this.later(1000, () => this.scheduleBed())
  }

  private chord(notes: number[], at: number) {
    const ctx = this.ctx!
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.Q.value = 0.6
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(0.05, at + 1.1)
    env.gain.setValueAtTime(0.05, at + CHORD_SECS - 1.2)
    env.gain.linearRampToValueAtTime(0, at + CHORD_SECS + 0.9)
    lp.connect(env)
    env.connect(this.bed!)
    const end = at + CHORD_SECS + 1
    for (const f of notes) {
      for (const detune of [-6, 5]) {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = f
        o.detune.value = detune
        o.connect(lp)
        o.start(at)
        o.stop(end)
      }
    }
    // soft sub under the root
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = notes[0] / 2
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0, at)
    sg.gain.linearRampToValueAtTime(0.07, at + 0.6)
    sg.gain.linearRampToValueAtTime(0, at + CHORD_SECS + 0.6)
    sub.connect(sg)
    sg.connect(this.bed!)
    sub.start(at)
    sub.stop(end)
  }

  private startCrackle() {
    const ctx = this.ctx
    if (!ctx || this.crackle) return
    const len = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.5 : 0)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1400
    const g = ctx.createGain()
    g.gain.value = 0.35
    src.connect(hp)
    hp.connect(g)
    g.connect(this.bed!)
    src.start()
    this.crackle = src
  }

  // --- sound effects -------------------------------------------------------------
  private onCue(c: Cue) {
    if (c.type === 'celebrate') this.chime()
    else if (c.type === 'say') this.blip()
  }

  private chime() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const now = ctx.currentTime
    ;[1046.5, 1568.0].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      const t = now + i * 0.13
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.09, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.3)
      o.connect(g)
      g.connect(this.sfx!)
      o.start(t)
      o.stop(t + 1.4)
    })
  }

  private blip() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const now = ctx.currentTime
    if (now - this.lastBlip < 1.4) return
    this.lastBlip = now
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(620, now)
    o.frequency.exponentialRampToValueAtTime(940, now + 0.07)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.035, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.14)
    o.connect(g)
    g.connect(this.sfx!)
    o.start(now)
    o.stop(now + 0.16)
  }

  // A short burst of soft key clicks, repeated while anyone is typing.
  private typeBurst() {
    const ctx = this.ctx
    if (!ctx || !this.enabled || !this.keys) return
    const n = 3 + Math.floor(Math.random() * 5)
    let t = ctx.currentTime + 0.05
    for (let i = 0; i < n; i++) {
      this.click(t)
      t += 0.07 + Math.random() * 0.09
    }
    this.later(1600 + Math.random() * 1800, () => this.typeBurst())
  }

  private click(at: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * 0.03)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400 + Math.random() * 1600
    bp.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.value = 0.05 + Math.random() * 0.03
    src.connect(bp)
    bp.connect(g)
    g.connect(this.sfx!)
    src.start(at)
  }
}

export const loungeAudio = new LoungeAudio()
