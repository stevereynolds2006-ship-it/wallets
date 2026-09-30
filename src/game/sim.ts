import { createEconomy, type Economy } from "./economy.ts"

export const LEVELS = [
  {
    layer: "01",
    name: "RAIN",
    line: "Code, falling like weather.",
    quota: 6,
    length: 420,
    cruise: 14,
    boost: 21,
    brake: 9,
    gravity: 0,
    gap: 24,
    pattern: "cube",
  },
  {
    layer: "02",
    name: "GRID",
    line: "The streets are transactions.",
    quota: 10,
    length: 500,
    cruise: 15.5,
    boost: 23,
    brake: 10,
    gravity: 0,
    gap: 20,
    pattern: "bar",
  },
  {
    layer: "03",
    name: "WAVE",
    line: "Time runs thick down here.",
    quota: 14,
    length: 560,
    cruise: 13,
    boost: 20,
    brake: 8,
    gravity: 0.45,
    gap: 28,
    pattern: "tide",
  },
  {
    layer: "04",
    name: "TESSERACT",
    line: "Some shelves lie about left.",
    quota: 18,
    length: 600,
    cruise: 16,
    boost: 23,
    brake: 10,
    gravity: 0,
    gap: 18,
    pattern: "shard",
  },
  {
    layer: "05",
    name: "GARGANTUA",
    line: "Feed the horizon.",
    quota: 24,
    length: 680,
    cruise: 16.5,
    boost: 24,
    brake: 11,
    gravity: 1.25,
    gap: 16,
    pattern: "orbit",
  },
] as const

export type Level = (typeof LEVELS)[number]
export type Phase = "menu" | "play" | "seal" | "pause" | "dead" | "won"

export type Input = {
  /** +1 is left, -1 is right. Keyboard and dock. */
  steer: number
  /** Desired world x while a finger is down on the dive. Null if not touching. */
  pointer: number | null
  boost: boolean
  brake: boolean
  burn: boolean
}

export type Fx = {
  coin: () => void
  burn: (name: string) => void
  hit: () => void
  seal: () => void
  deny: () => void
  win: () => void
  die: () => void
}

export type HazardKind = "cube" | "bar" | "tide" | "shard" | "orbit" | "invert"

export type Hazard = {
  on: boolean
  kind: HazardKind
  x: number
  hw: number
  z: number
  phase: number
  tripped: boolean
}

export type Coin = {
  on: boolean
  x: number
  z: number
  value: number
  spin: number
}

export type Particle = {
  on: boolean
  x: number
  z: number
  vx: number
  vz: number
  life: number
  amber: boolean
}

export type Floater = {
  on: boolean
  text: string
  life: number
  rise: number
  amber: boolean
}

export type Sim = {
  phase: Phase
  level: number
  time: number
  distance: number
  x: number
  vx: number
  yaw: number
  speed: number
  integrity: number
  burnedLevel: number
  chain: number
  chainMax: number
  score: number
  phaseTime: number
  burnLock: number
  denyLock: number
  iframes: number
  invertT: number
  hitStop: number
  shake: number
  shock: number
  banner: string
  bannerSub: string
  bannerT: number
  lastBurn: string
  sealT: number
  endT: number
  sinceHazard: number
  sinceCoin: number
  pity: number
  spawnIndex: number
  rng: number
  economy: Economy | null
  hazards: Hazard[]
  coins: Coin[]
  particles: Particle[]
  floaters: Floater[]
}

export const emptyFx: Fx = {
  coin() {},
  burn() {},
  hit() {},
  seal() {},
  deny() {},
  win() {},
  die() {},
}

function hazard(): Hazard {
  return { on: false, kind: "cube", x: 0, hw: 0.2, z: 0, phase: 0, tripped: false }
}
function coin(): Coin {
  return { on: false, x: 0, z: 0, value: 1, spin: 0 }
}
function particle(): Particle {
  return { on: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, amber: false }
}
function floater(): Floater {
  return { on: false, text: "", life: 0, rise: 0, amber: false }
}

export function createSim(): Sim {
  return {
    phase: "menu",
    level: 0,
    time: 0,
    distance: 0,
    x: 0,
    vx: 0,
    yaw: 0,
    speed: 0,
    integrity: 3,
    burnedLevel: 0,
    chain: 0,
    chainMax: 0,
    score: 0,
    phaseTime: 0,
    burnLock: 0,
    denyLock: 0,
    iframes: 0,
    invertT: 0,
    hitStop: 0,
    shake: 0,
    shock: 0,
    banner: "",
    bannerSub: "",
    bannerT: 0,
    lastBurn: "",
    sealT: 0,
    endT: 0,
    sinceHazard: 0,
    sinceCoin: 0,
    pity: 0,
    spawnIndex: 0,
    rng: 0x51a7e,
    economy: null,
    hazards: Array.from({ length: 40 }, hazard),
    coins: Array.from({ length: 32 }, coin),
    particles: Array.from({ length: 140 }, particle),
    floaters: Array.from({ length: 14 }, floater),
  }
}

function rnd(sim: Sim) {
  sim.rng = (sim.rng + 0x6d2b79f5) | 0
  let t = Math.imul(sim.rng ^ (sim.rng >>> 15), 1 | sim.rng)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function take<T extends { on: boolean }>(pool: T[]): T | null {
  for (let i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i]
  return null
}

function clearPool(pool: { on: boolean }[]) {
  for (let i = 0; i < pool.length; i++) pool[i].on = false
}

function say(sim: Sim, text: string, amber: boolean) {
  let slot: Floater | null = null
  for (let i = 0; i < sim.floaters.length; i++) {
    if (!sim.floaters[i].on) {
      slot = sim.floaters[i]
      break
    }
  }
  if (!slot) {
    slot = sim.floaters[0]
    for (let i = 1; i < sim.floaters.length; i++) {
      if (sim.floaters[i].life < slot.life) slot = sim.floaters[i]
    }
  }
  slot.on = true
  slot.text = text
  slot.life = 0.95
  slot.rise = 0
  slot.amber = amber
}

function burst(sim: Sim, x: number, z: number, amber: boolean, n: number) {
  for (let i = 0; i < n; i++) {
    const p = take(sim.particles)
    if (!p) return
    p.on = true
    p.x = x
    p.z = z
    p.vx = (rnd(sim) - 0.5) * 2.4
    p.vz = (rnd(sim) - 0.4) * 1.4
    p.life = 0.35 + rnd(sim) * 0.35
    p.amber = amber
  }
}

function spawnCoin(sim: Sim, x: number, value: number, z = 12.5) {
  const c = take(sim.coins)
  if (!c) return
  c.on = true
  c.x = x
  c.z = z
  c.value = value
  c.spin = rnd(sim) * Math.PI
}

function spawnHazard(sim: Sim, kind: HazardKind, x: number, hw: number) {
  const h = take(sim.hazards)
  if (!h) return
  h.on = true
  h.kind = kind
  h.x = x
  h.hw = hw
  h.z = 12.8
  h.phase = rnd(sim) * Math.PI * 2
  h.tripped = false
}

function lane(sim: Sim) {
  const lanes = [-0.72, -0.24, 0.24, 0.72]
  return lanes[Math.floor(rnd(sim) * lanes.length)] ?? 0
}

export function levelOf(sim: Sim): Level {
  return LEVELS[sim.level] ?? LEVELS[0]
}

function beginLevel(sim: Sim, index: number) {
  sim.level = index
  sim.distance = 0
  sim.burnedLevel = 0
  sim.sinceHazard = -36
  sim.sinceCoin = -8
  sim.pity = 0
  sim.spawnIndex = 0
  sim.phase = "play"
  sim.speed = LEVELS[index].cruise
  sim.banner = `STRATA ${LEVELS[index].layer}`
  sim.bannerSub = LEVELS[index].name
  sim.bannerT = 2.3
  clearPool(sim.hazards)
  clearPool(sim.coins)
}

export function startRun(sim: Sim) {
  sim.economy = createEconomy()
  sim.integrity = 3
  sim.x = 0
  sim.vx = 0
  sim.yaw = 0
  sim.chain = 0
  sim.chainMax = 0
  sim.score = 0
  sim.phaseTime = 0
  sim.burnLock = 0
  sim.denyLock = 0
  sim.iframes = 0
  sim.invertT = 0
  sim.hitStop = 0
  sim.shake = 0
  sim.shock = 0
  sim.lastBurn = ""
  sim.sealT = 0
  sim.endT = 0
  sim.phase = "play"
  clearPool(sim.particles)
  clearPool(sim.floaters)
  beginLevel(sim, 0)
}

function scoreOf(sim: Sim) {
  const econ = sim.economy
  if (!econ) return
  const net = Math.max(0, econ.burned - econ.returned)
  sim.score =
    econ.burned * 30 +
    net * 20 +
    econ.collected * 8 +
    sim.level * 2000 +
    Math.floor(sim.distance) +
    sim.chainMax * 15
}

function crack(sim: Sim, fx: Fx) {
  sim.phase = "seal"
  sim.sealT = 1.55
  sim.banner = "STRATA CRACKED"
  sim.bannerSub = levelOf(sim).name
  sim.bannerT = 1.5
  sim.shake = 0.7
  fx.seal()
}

function hurt(sim: Sim, fx: Fx) {
  sim.integrity -= 1
  sim.iframes = 1.15
  sim.shake = 1
  sim.hitStop = 0.07
  sim.chain = 0
  sim.vx *= -0.4
  burst(sim, sim.x, 0.7, false, 14)
  fx.hit()
  if (sim.integrity <= 0) {
    sim.phase = "dead"
    sim.endT = 0
    sim.banner = "COLLAPSED"
    sim.bannerSub = "The dive ate the wallet."
    sim.bannerT = 3
    fx.die()
  } else {
    say(sim, "GLITCH", false)
  }
}

function overlaps(sim: Sim, h: Hazard) {
  if (h.kind === "invert") return false
  if (h.z > 1.02 || h.z < 0.18) return false
  if (h.kind === "tide") {
    const gap = Math.sin(sim.time * 0.85 + h.phase) * 0.42
    h.x = gap
    return Math.abs(sim.x - gap) > 0.36
  }
  return Math.abs(h.x - sim.x) < h.hw + 0.15
}

function spawnPattern(sim: Sim) {
  const pattern = levelOf(sim).pattern
  sim.spawnIndex += 1
  if (pattern === "cube") spawnHazard(sim, "cube", lane(sim), 0.22)
  else if (pattern === "bar") spawnHazard(sim, "bar", 0, 0.4)
  else if (pattern === "tide") spawnHazard(sim, "tide", 0, 0.36)
  else if (pattern === "shard") {
    spawnHazard(sim, "shard", lane(sim), 0.16)
    if (sim.spawnIndex % 3 === 0) spawnHazard(sim, "invert", 0, 1.2)
  } else {
    spawnHazard(sim, "orbit", 0, 0.2)
    if (sim.spawnIndex % 2 === 0) spawnHazard(sim, "cube", lane(sim), 0.18)
  }
}

function moveHazard(sim: Sim, h: Hazard, dz: number) {
  if (h.kind === "bar") h.x = Math.sin(sim.time * 1.25 + h.phase) * 0.68
  if (h.kind === "orbit") h.x = Math.sin(sim.time * 1.8 + h.phase) * 0.86
  if (h.kind === "shard") h.z -= dz * 1.28
  else h.z -= dz
}

export function step(sim: Sim, input: Input, dt: number, fx: Fx = emptyFx) {
  if (sim.phase === "seal") {
    sim.sealT -= dt
    sim.bannerT = Math.max(0, sim.bannerT - dt)
    sim.shake = Math.max(0, sim.shake - dt * 1.4)
    if (sim.shock > 0) {
      sim.shock += dt * 2.2
      if (sim.shock > 1) sim.shock = 0
    }
    if (sim.sealT <= 0) {
      if (sim.level >= LEVELS.length - 1) {
        sim.phase = "won"
        sim.endT = 0
        sim.banner = "JACKED OUT"
        sim.bannerSub = "Gargantua kept the ash."
        sim.bannerT = 4
        fx.win()
      } else beginLevel(sim, sim.level + 1)
    }
    return
  }
  if (sim.phase !== "play" || !sim.economy) return

  if (sim.hitStop > 0) {
    sim.hitStop -= dt
    return
  }

  const level = levelOf(sim)
  let steer = input.steer
  if (sim.invertT > 0) steer = -steer

  if (input.pointer !== null) {
    const aimed = sim.invertT > 0 ? -input.pointer : input.pointer
    const target = Math.max(-1.08, Math.min(1.08, aimed))
    sim.vx = (target - sim.x) * 8
    sim.x += sim.vx * dt
    const visual = Math.max(-1, Math.min(1, (sim.x - target) * 3))
    const yawTarget = visual * 0.7
    sim.yaw += (yawTarget - sim.yaw) * Math.min(1, dt * 8)
  } else {
    const desired = -steer * 2.55
    sim.vx += (desired - sim.vx) * Math.min(1, dt * 9)
    if (sim.phaseTime <= 0) sim.vx += -sim.x * level.gravity * dt * 2.5
    sim.x += sim.vx * dt
    const yawTarget = steer * 0.68
    sim.yaw += (yawTarget - sim.yaw) * Math.min(1, dt * 8)
  }
  if (sim.x > 1.08) {
    sim.x = 1.08
    sim.vx = 0
  } else if (sim.x < -1.08) {
    sim.x = -1.08
    sim.vx = 0
  }

  let targetSpeed: number = level.cruise
  if (input.boost) targetSpeed = level.boost
  else if (input.brake) targetSpeed = level.brake
  if (sim.phaseTime > 0) targetSpeed *= 0.62
  sim.speed += (targetSpeed - sim.speed) * Math.min(1, dt * 3.2)

  sim.distance += sim.speed * dt
  sim.sinceHazard += sim.speed * dt
  sim.sinceCoin += sim.speed * dt
  sim.bannerT = Math.max(0, sim.bannerT - dt)
  sim.phaseTime = Math.max(0, sim.phaseTime - dt)
  sim.burnLock = Math.max(0, sim.burnLock - dt)
  sim.denyLock = Math.max(0, sim.denyLock - dt)
  sim.iframes = Math.max(0, sim.iframes - dt)
  sim.invertT = Math.max(0, sim.invertT - dt)
  sim.shake = Math.max(0, sim.shake - dt * 1.6)
  if (sim.shock > 0) {
    sim.shock += dt * 2.4
    if (sim.shock > 1) sim.shock = 0
  }

  if (input.burn && sim.burnLock <= 0 && sim.phaseTime <= 0.08) {
    const result = sim.economy.burn()
    if (result) {
      sim.burnLock = 0.46
      sim.phaseTime = 0.74
      sim.burnedLevel += 1
      sim.shock = 0.02
      sim.lastBurn = result.name
      burst(sim, sim.x, 0.85, true, 18)
      if (result.rebate > 0) say(sim, `${result.name.toUpperCase()} +${result.rebate}`, true)
      else say(sim, result.name.toUpperCase(), true)
      fx.burn(result.name)
    } else if (sim.denyLock <= 0) {
      sim.denyLock = 0.7
      say(sim, "NO RF", false)
      fx.deny()
    }
  }

  if (sim.sinceHazard >= level.gap) {
    sim.sinceHazard = 0
    spawnPattern(sim)
  }
  if (sim.sinceCoin >= 15) {
    sim.sinceCoin = 0
    const heavy = rnd(sim) < 0.09
    spawnCoin(sim, Math.max(-0.95, Math.min(0.95, lane(sim) + (rnd(sim) - 0.5) * 0.2)), heavy ? 3 : 1)
    if (rnd(sim) < 0.22) spawnCoin(sim, lane(sim), 1, 11.2)
  }

  if (sim.economy.wallet <= 0 && sim.burnedLevel < level.quota) {
    sim.pity += dt
    if (sim.pity > 1.2) {
      sim.pity = 0
      spawnCoin(sim, sim.x, 1, 8)
    }
  } else sim.pity = 0

  const dz = sim.speed * 0.26 * dt
  const phasing = sim.phaseTime > 0

  for (let i = 0; i < sim.hazards.length; i++) {
    const h = sim.hazards[i]
    if (!h.on) continue
    moveHazard(sim, h, dz)
    if (h.kind === "invert" && !h.tripped && h.z < 1.35) {
      h.tripped = true
      sim.invertT = 1.65
      say(sim, "INVERT", true)
    }
    if (phasing && h.kind !== "invert" && overlaps(sim, h)) {
      h.on = false
      burst(sim, h.x, Math.max(0.4, h.z), true, 8)
      continue
    }
    if (sim.iframes <= 0 && overlaps(sim, h)) {
      h.on = false
      hurt(sim, fx)
      if (sim.phase !== "play") return
    }
    if (h.z < 0.05) h.on = false
  }

  for (let i = 0; i < sim.coins.length; i++) {
    const c = sim.coins[i]
    if (!c.on) continue
    if (phasing) c.x += (sim.x - c.x) * Math.min(1, dt * 7)
    c.z -= dz * (phasing ? 1.15 : 1)
    c.spin += dt * 5
    const reach = phasing ? 0.52 : 0.28
    if (c.z < 1.05 && c.z > 0.12 && Math.abs(c.x - sim.x) < reach) {
      c.on = false
      sim.economy.collect(c.value)
      sim.chain += 1
      if (sim.chain > sim.chainMax) sim.chainMax = sim.chain
      burst(sim, c.x, 0.7, true, 6)
      if (c.value > 1) say(sim, `+${c.value} RF`, true)
      else if (sim.chain === 6 || sim.chain === 12 || sim.chain === 18) say(sim, `CHAIN ${sim.chain}`, false)
      fx.coin()
    } else if (c.z < 0.05) c.on = false
  }

  for (let i = 0; i < sim.particles.length; i++) {
    const p = sim.particles[i]
    if (!p.on) continue
    p.life -= dt
    p.x += p.vx * dt
    p.z += p.vz * dt
    if (p.life <= 0) p.on = false
  }
  for (let i = 0; i < sim.floaters.length; i++) {
    const f = sim.floaters[i]
    if (!f.on) continue
    f.life -= dt
    f.rise += dt * 46
    if (f.life <= 0) f.on = false
  }

  if (sim.distance >= level.length) {
    if (sim.burnedLevel >= level.quota) crack(sim, fx)
    else {
      sim.distance = level.length * 0.58
      sim.banner = `BURN ${level.quota - sim.burnedLevel} MORE`
      sim.bannerSub = "The seal is still shut."
      sim.bannerT = 1.5
      sim.shake = 0.45
      fx.deny()
    }
  }

  scoreOf(sim)
}
