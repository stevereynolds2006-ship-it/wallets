export type AudioBus = {
  unlock: () => void
  setMuted: (muted: boolean) => void
  setDrive: (heat: number, speed: number, phasing: boolean) => void
  coin: () => void
  burn: () => void
  hit: () => void
  seal: () => void
  deny: () => void
  win: () => void
  dispose: () => void
}

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let drone: OscillatorNode | null = null
  let muted = false

  function ensure() {
    if (ctx) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.2
    master.connect(ctx.destination)
    drone = ctx.createOscillator()
    drone.type = "sawtooth"
    drone.frequency.value = 48
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 220
    const gain = ctx.createGain()
    gain.gain.value = 0.045
    drone.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    drone.start()
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
    if (!ctx || !master || muted) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  return {
    unlock() {
      ensure()
      if (ctx && ctx.state === "suspended") void ctx.resume()
    },
    setMuted(next) {
      muted = next
      if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.2, ctx.currentTime, 0.03)
    },
    dispose() {
      try {
        drone?.stop()
      } catch {
        /* already stopped */
      }
      void ctx?.close()
      ctx = null
      master = null
      drone = null
    },
    setDrive(heat, speed, phasing) {
      if (!drone || !ctx || muted) return
      const freq = (phasing ? 34 : 46) + heat * 22 + Math.max(0, speed - 12) * 0.35
      drone.frequency.setTargetAtTime(freq, ctx.currentTime, 0.12)
    },
    coin() {
      tone(740, 0.07, "square", 0.05)
      tone(1180, 0.09, "square", 0.03, 0.04)
    },
    burn() {
      tone(210, 0.16, "sawtooth", 0.06)
      tone(90, 0.28, "triangle", 0.05, 0.02)
    },
    hit() {
      tone(64, 0.22, "sawtooth", 0.08)
    },
    seal() {
      tone(392, 0.12, "square", 0.05)
      tone(523, 0.14, "square", 0.05, 0.09)
      tone(784, 0.2, "square", 0.04, 0.18)
    },
    deny() {
      tone(140, 0.14, "square", 0.04)
    },
    win() {
      tone(523, 0.14, "square", 0.05)
      tone(659, 0.16, "square", 0.05, 0.1)
      tone(880, 0.28, "square", 0.05, 0.2)
    },
  }
}
