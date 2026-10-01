import { spriteFrame } from "@rarefriends/friendsdk/sprites"
import { PALETTE } from "./palette"
import { LEVELS, levelOf, type Sim } from "./sim"

const GLYPHS = "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾜﾝ0123456789RF$"

type Col = { x: number; y: number; speed: number; seed: number }

export type Scene = {
  cols: Col[]
  width: number
  stamp: number
}

export function createScene(): Scene {
  return { cols: [], width: 0, stamp: 0 }
}

function ensureRain(scene: Scene, w: number, h: number, reduced: boolean) {
  const count = Math.max(10, Math.floor(w / (reduced ? 28 : 16)))
  if (scene.cols.length === count && scene.width === w) return
  scene.width = w
  scene.cols = Array.from({ length: count }, (_, i) => ({
    x: ((i + 0.5) * w) / count,
    y: Math.random() * h,
    speed: 50 + Math.random() * 110,
    seed: Math.random() * 100,
  }))
}

const SPRITE = [
  ".....GGGGGG....",
  "...GGWWWWWWGG..",
  "..GGWWddddWWGG.",
  "..GGWWWWWWWWGG.",
  "...GGGGGGGGGG..",
  "..DDGGGGGGGGDD.",
  ".DDGAAAAAAAAGDD",
  ".DDGAAAAAAAAADD",
  ".DDGAAAAAAAAGDD",
  "..DDGGGGGGGGDD.",
  "...GGGGGGGGGG..",
  "....GGGGGGGG...",
  ".....GG..GG....",
  "....GGG..GGG...",
  "...GG......GG..",
]

const SPRITE_B = [
  ".....GGGGGG....",
  "...GGWWWWWWGG..",
  "..GGWWddddWWGG.",
  "..GGWWWWWWWWGG.",
  "...GGGGGGGGGG..",
  "..DDGGGGGGGGDD.",
  ".DDGAAAAAAAAGDD",
  ".DDGAAAAAAAAADD",
  ".DDGAAAAAAAAGDD",
  "..DDGGGGGGGGDD.",
  "...GGGGGGGGGG..",
  "....GGGGGGGG...",
  ".....G....G....",
  "....GG....GG...",
  "...GG......GG..",
]

function paintSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  frame: number,
  hot: boolean,
  lean: number,
) {
  const rows = frame ? SPRITE_B : SPRITE
  const cols = rows[0]?.length ?? 0
  const rowsN = rows.length
  const on = (r: number, c: number) => {
    const row = rows[r]
    return !!row && row[c] !== undefined && row[c] !== "."
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(lean)
  ctx.translate(-(cols * scale) / 2, -rowsN * scale + scale)
  const body = hot ? PALETTE.amberHot : PALETTE.phosphor
  const deep = hot ? "#8A5A08" : "#0c3d24"
  for (let r = -1; r <= rowsN; r++) {
    for (let c = -1; c <= cols; c++) {
      if (on(r, c)) continue
      if (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1)) {
        ctx.fillStyle = "#021108"
        ctx.fillRect(c * scale, r * scale, scale, scale)
      }
    }
  }
  for (let r = 0; r < rowsN; r++) {
    const row = rows[r] ?? ""
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (!ch || ch === ".") continue
      ctx.fillStyle = ch === "A" ? PALETTE.amber : ch === "W" ? PALETTE.bone : ch === "d" || ch === "D" ? deep : body
      ctx.fillRect(c * scale, r * scale, scale, scale)
    }
  }
  ctx.restore()
}

function paintNft(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  y: number,
  scale: number,
  hot: boolean,
  reduced: boolean,
) {
  const diver = sim.diver
  if (!diver) return
  const facing = sim.yaw > 0.18 ? "left" : sim.yaw < -0.18 ? "right" : "down"
  const walking = sim.phase === "play" && sim.speed > 8
  const frame = Math.floor(sim.time * (reduced ? 2 : 8)) % 8
  const rows = spriteFrame(diver.sprites, facing, walking, frame).frame.rows
  const cols = rows[0]?.length ?? 16
  ctx.save()
  ctx.translate(x, y)
  ctx.translate(-(cols * scale) / 2, -rows.length * scale + scale)
  const ink = hot ? PALETTE.amberHot : PALETTE.bone
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? ""
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== "#") continue
      ctx.fillStyle = "#021108"
      ctx.fillRect(c * scale - 1, r * scale - 1, scale + 2, scale + 2)
    }
  }
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? ""
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== "#") continue
      ctx.fillStyle = ink
      ctx.fillRect(c * scale, r * scale, scale, scale)
    }
  }
  ctx.restore()
}

function project(z: number) {
  const n = 1 - Math.min(1, Math.max(0, z / 13))
  return Math.pow(n, 1.28)
}

function drawHole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  heat: number,
  time: number,
  reduced: boolean,
) {
  const spin = reduced ? 0.4 : time
  const glow = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 2.5)
  glow.addColorStop(0, "rgba(0,0,0,0)")
  glow.addColorStop(0.42, `rgba(255,178,10,${0.08 + heat * 0.28})`)
  glow.addColorStop(0.62, `rgba(61,255,138,${0.04 + (1 - heat) * 0.05})`)
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(cx, cy, r * 2.7, r * 1.05, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, 0.38)
  ctx.rotate(spin * 0.12)
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.strokeStyle = i % 2 === 0 ? "rgba(255,178,10,0.7)" : "rgba(255,231,163,0.35)"
    ctx.lineWidth = 2 + (4 - i) * 0.4
    ctx.arc(0, 0, r * (0.7 + i * 0.16), spin * 0.3 + i * 0.7, spin * 0.3 + i * 0.7 + 1.7)
    ctx.stroke()
  }
  ctx.restore()

  ctx.beginPath()
  ctx.fillStyle = "#000000"
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.strokeStyle = `rgba(231,255,242,${0.28 + heat * 0.45})`
  ctx.lineWidth = 1.5
  ctx.ellipse(cx, cy, r * 0.46, r * 0.18, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = `rgba(255,178,10,${0.18 + heat * 0.25})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - r * 2.4, cy)
  ctx.lineTo(cx + r * 2.4, cy)
  ctx.stroke()

  ctx.strokeStyle = `rgba(231,255,242,${0.12 + heat * 0.12})`
  for (let i = 0; i < 4; i++) {
    const a = spin * 0.35 + (i * Math.PI) / 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.2)
    ctx.lineTo(cx + Math.cos(a) * r * 2.8, cy + Math.sin(a) * r * 0.72)
    ctx.stroke()
  }
}

function drawTunnel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  vy: number,
  time: number,
  heat: number,
  reduced: boolean,
) {
  const floor = ctx.createLinearGradient(0, vy, 0, h)
  floor.addColorStop(0, "rgba(0,0,0,0)")
  floor.addColorStop(0.2, heat > 0.55 ? "rgba(80,28,6,0.28)" : "rgba(8,48,28,0.38)")
  floor.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = floor
  ctx.fillRect(0, vy, w, h - vy)

  const ink = heat > 0.55 ? "255,178,10" : "61,255,138"
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(${ink},0.28)`
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * 6, vy)
    ctx.lineTo(cx + i * w * 0.085, h)
    ctx.stroke()
  }
  const rows = reduced ? 5 : 9
  const scroll = reduced ? 0.2 : (time * (0.28 + heat * 0.22)) % 1
  for (let i = 0; i < rows; i++) {
    const p = (i / rows + scroll) % 1
    const y = vy + Math.pow(p, 1.55) * (h - vy)
    const spread = ((y - vy) / Math.max(1, h - vy)) * w
    ctx.globalAlpha = 0.12 + p * 0.7
    ctx.beginPath()
    ctx.moveTo(cx - spread, y)
    ctx.lineTo(cx + spread, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function motif(ctx: CanvasRenderingContext2D, w: number, h: number, pattern: string, time: number, cx: number, vy: number) {
  ctx.save()
  if (pattern === "grid" || pattern === "cube") {
    ctx.strokeStyle = "rgba(61,255,138,0.16)"
    ctx.lineWidth = 1
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath()
      ctx.moveTo(cx, vy)
      ctx.lineTo(cx + i * w * 0.09, h)
      ctx.stroke()
    }
    const scroll = (time * 0.35) % 1
    for (let i = 0; i < 8; i++) {
      const p = (i / 8 + scroll) % 1
      const y = vy + Math.pow(p, 1.55) * (h * 0.92 - vy)
      const spread = ((y - vy) / Math.max(1, h - vy)) * w * 0.7
      ctx.beginPath()
      ctx.moveTo(cx - spread, y)
      ctx.lineTo(cx + spread, y)
      ctx.stroke()
    }
  }
  if (pattern === "tide") {
    ctx.strokeStyle = "rgba(255,178,10,0.35)"
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.62 + Math.sin(x * 0.02 + time * 1.4) * 16 + Math.sin(x * 0.008 - time) * 10
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  if (pattern === "shard") {
    ctx.strokeStyle = "rgba(255,231,163,0.18)"
    ctx.lineWidth = 1
    const columns = 7
    for (let i = 0; i < columns; i++) {
      const x = (w / columns) * (i + 0.5) + Math.sin(time * 0.4 + i) * 6
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + (x - cx) * 0.15, h)
      ctx.stroke()
    }
  }
  ctx.restore()
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  sim: Sim,
  w: number,
  h: number,
  reduced: boolean,
  insets: { top: number; bottom: number },
) {
  const attract = sim.phase === "menu"
  const level = levelOf(sim)
  const heat = sim.phase === "won" ? 1 : sim.level / (LEVELS.length - 1)
  const cx = w / 2
  const top = insets.top
  const bottom = h - insets.bottom
  const playerY = attract ? h * (w > 900 ? 0.48 : 0.27) : bottom - Math.min(140, h * 0.2)
  const vy = attract ? h * 0.2 : top + (playerY - top) * 0.16
  const bob = attract ? Math.sin(sim.time * 1.6) * 8 : 0
  const displayX = attract ? (w > 900 ? 0.62 : Math.sin(sim.time * 0.8) * 0.18) : sim.x
  const friendX = cx + displayX * w * 0.3
  const shake = reduced ? 0 : sim.shake * 7

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, heat > 0.55 ? "#2a1206" : "#062016")
  sky.addColorStop(0.42, PALETTE.void)
  sky.addColorStop(1, heat > 0.55 ? "#100804" : "#010403")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  if (!reduced && !attract) {
    for (let i = 0; i < 48; i++) {
      const drift = sim.time * (10 + (i % 6) * 4)
      const sx = ((i * 97) % 1000) / 1000 * w
      const sy = ((((i * 53) % 100) / 100) * h + (drift % (h * 0.35)) + h) % h
      ctx.globalAlpha = 0.18 + (i % 5) * 0.08
      ctx.fillStyle = i % 8 === 0 ? PALETTE.amber : PALETTE.bone
      const z = i % 4 === 0 ? 2 : 1
      ctx.fillRect(sx, sy, z, z)
    }
    ctx.globalAlpha = 1
  }

  ctx.save()
  if (shake > 0) ctx.translate(Math.sin(sim.time * 90) * shake, Math.cos(sim.time * 70) * shake * 0.6)

  if (!attract) drawTunnel(ctx, w, h, cx, vy, sim.time, heat, reduced)

  ensureRain(scene, w, h, reduced)
  const rainDt = scene.stamp ? Math.min(0.05, Math.max(0, sim.time - scene.stamp)) : 0.016
  scene.stamp = sim.time
  const rainBoost = sim.phaseTime > 0 && !reduced ? 2.6 : 1
  ctx.font = "12px 'IBM Plex Mono', ui-monospace, monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let i = 0; i < scene.cols.length; i++) {
    const col = scene.cols[i]
    col.y += col.speed * rainBoost * rainDt
    if (col.y > h + 80) col.y = -40
    const trail = reduced ? 6 : 12
    for (let k = 0; k < trail; k++) {
      const y = col.y - k * 14
      if (y < -10 || y > h + 10) continue
      const head = k === 0
      const amberTrail = heat > 0.72 || (sim.phaseTime > 0 && k < 3)
      ctx.globalAlpha = head ? 0.72 : Math.max(0, 0.3 - k * 0.028) * (0.35 + heat * 0.15)
      ctx.fillStyle = head ? PALETTE.bone : amberTrail ? PALETTE.amber : PALETTE.phosphor
      const idx = Math.floor(col.seed * 20 + sim.time * (reduced ? 0 : 8) + k + i) % GLYPHS.length
      ctx.fillText(GLYPHS[idx] || "0", col.x, y)
    }
  }
  ctx.globalAlpha = 1

  const holeR = (attract ? 46 : 34 + heat * 58) + (sim.phase === "won" ? sim.endT * 30 : 0)
  drawHole(ctx, cx, vy, holeR, heat, sim.time, reduced)
  motif(ctx, w, h, attract ? "cube" : level.pattern, sim.time, cx, vy)

  const spread = w * 0.34
  for (let i = 0; i < sim.coins.length; i++) {
    const c = sim.coins[i]
    if (!c.on) continue
    const depth = project(c.z)
    const x = cx + c.x * (0.25 + depth * 0.75) * spread
    const y = vy + depth * (playerY - vy)
    const s = 3 + depth * (c.value > 1 ? 16 : 11)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(c.spin)
    ctx.shadowColor = c.value > 1 ? PALETTE.amberHot : PALETTE.amber
    ctx.shadowBlur = reduced ? 0 : 12 * depth
    ctx.strokeStyle = c.value > 1 ? PALETTE.amberHot : PALETTE.amber
    ctx.lineWidth = Math.max(1.5, s * 0.22)
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.62, Math.PI * 0.15, Math.PI * 1.35)
    ctx.stroke()
    ctx.fillStyle = PALETTE.amberHot
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(1.5, s * 0.28), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    if (depth > 0.45) {
      ctx.globalAlpha = depth
      ctx.fillStyle = PALETTE.panel
      ctx.font = `${Math.max(8, s)}px 'IBM Plex Mono', monospace`
      ctx.textAlign = "center"
      ctx.fillText(c.value > 1 ? "3" : "R", x, y + 1)
      ctx.globalAlpha = 1
    }
  }

  for (let i = 0; i < sim.hazards.length; i++) {
    const hz = sim.hazards[i]
    if (!hz.on) continue
    const depth = project(hz.z)
    const x = cx + hz.x * (0.25 + depth * 0.75) * spread
    const y = vy + depth * (playerY - vy)
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha = 0.45 + depth * 0.55
    ctx.shadowColor = hz.kind === "orbit" || hz.kind === "invert" ? PALETTE.amber : PALETTE.phosphor
    ctx.shadowBlur = reduced ? 0 : 16 * depth
    if (hz.kind === "invert") {
      ctx.strokeStyle = PALETTE.amberHot
      ctx.lineWidth = 2
      ctx.strokeRect(-w * 0.36 * depth - 20, -8 - depth * 10, w * 0.72 * depth + 40, 16 + depth * 20)
    } else if (hz.kind === "tide") {
      const half = 22 + depth * 36
      ctx.fillStyle = "rgba(61,255,138,0.2)"
      ctx.strokeStyle = PALETTE.phosphor
      ctx.lineWidth = 2
      ctx.fillRect(-w, -half, w - half, half * 2)
      ctx.strokeRect(-w, -half, w - half, half * 2)
      ctx.fillRect(half, -half, w, half * 2)
      ctx.strokeRect(half, -half, w, half * 2)
    } else if (hz.kind === "orbit") {
      const size = 10 + depth * 28
      ctx.strokeStyle = PALETTE.amberHot
      ctx.fillStyle = "rgba(255,178,10,0.18)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      const size = (8 + depth * 36) * (hz.kind === "bar" ? 1.7 : 1)
      ctx.strokeStyle = PALETTE.bone
      ctx.fillStyle = hz.kind === "shard" ? "rgba(255,231,163,0.16)" : "rgba(61,255,138,0.14)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size, 0)
      ctx.lineTo(0, size * 0.85)
      ctx.lineTo(-size, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  for (let i = 0; i < sim.particles.length; i++) {
    const p = sim.particles[i]
    if (!p.on) continue
    const depth = project(Math.max(0.2, p.z))
    const x = cx + p.x * (0.25 + depth * 0.75) * spread
    const y = vy + depth * (playerY - vy)
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.amber ? PALETTE.amber : PALETTE.phosphor
    ctx.fillRect(x, y, 2 + depth * 3, 2 + depth * 3)
  }
  ctx.globalAlpha = 1

  if (sim.shock > 0) {
    ctx.beginPath()
    ctx.strokeStyle = `rgba(255,178,10,${1 - sim.shock})`
    ctx.lineWidth = 2
    ctx.ellipse(friendX, playerY + bob - 20, 20 + sim.shock * w * 0.28, 12 + sim.shock * 70, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  const blink = sim.iframes > 0 && Math.sin(sim.time * 40) > 0
  if (!blink && sim.phase !== "dead") {
    const scale = attract ? Math.max(7, Math.round(Math.min(w, h) / 70)) : Math.max(5, Math.round(Math.min(w, h) / 92))
    if (!attract && sim.speed > 8 && !reduced) {
      ctx.strokeStyle = sim.phaseTime > 0 ? "rgba(255,178,10,0.45)" : "rgba(61,255,138,0.35)"
      ctx.lineWidth = 2
      const streak = 18 + sim.speed * 1.4
      for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * scale * 1.3
        ctx.globalAlpha = 0.25 + (1 - Math.abs(i - 2) / 3) * 0.45
        ctx.beginPath()
        ctx.moveTo(friendX + ox, playerY + bob + 4)
        ctx.lineTo(friendX + ox * 0.4, playerY + bob + streak)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    if (!attract && (sim.speed > 12 || sim.phase === "play")) {
      ctx.fillStyle = PALETTE.amber
      ctx.globalAlpha = 0.85
      const flame = 6 + Math.sin(sim.time * 28) * 3
      ctx.fillRect(friendX - scale, playerY + bob - 2, scale * 2, flame)
      ctx.globalAlpha = 1
    }
    if (!sim.diver) {
      ctx.fillStyle = "rgba(3,8,6,0.78)"
      ctx.beginPath()
      ctx.arc(friendX, playerY + bob - scale * 7, scale * 11, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.beginPath()
    ctx.ellipse(friendX, playerY + bob + scale * 1.4, scale * 7, scale * 2.1, 0, 0, Math.PI * 2)
    ctx.fill()
    const glow = ctx.createRadialGradient(friendX, playerY + bob - scale * 7, 4, friendX, playerY + bob - scale * 6, scale * 16)
    glow.addColorStop(0, sim.phaseTime > 0 ? "rgba(255,178,10,0.55)" : "rgba(61,255,138,0.35)")
    glow.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(friendX, playerY + bob - scale * 7, scale * 16, 0, Math.PI * 2)
    ctx.fill()
    if (sim.diver) {
      paintNft(ctx, sim, friendX, playerY + bob, Math.max(4, Math.round(scale * 0.72)), sim.phaseTime > 0, reduced)
    } else {
      paintSprite(
        ctx,
        friendX,
        playerY + bob,
        scale,
        Math.floor(sim.time * 8) % 2,
        sim.phaseTime > 0,
        reduced ? 0 : -sim.yaw * 0.45,
      )
    }
  }

  for (let i = 0; i < sim.floaters.length; i++) {
    const f = sim.floaters[i]
    if (!f.on) continue
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life))
    ctx.fillStyle = f.amber ? PALETTE.amber : PALETTE.bone
    ctx.font = "600 13px 'IBM Plex Mono', ui-monospace, monospace"
    ctx.textAlign = "center"
    ctx.fillText(f.text, friendX, playerY - 70 - f.rise)
  }
  ctx.globalAlpha = 1

  if (sim.bannerT > 0 && sim.banner) {
    const alpha = Math.min(1, sim.bannerT)
    ctx.globalAlpha = alpha
    ctx.textAlign = "center"
    ctx.fillStyle = PALETTE.bone
    ctx.font = "800 40px 'Big Shoulders Display', 'Arial Narrow', sans-serif"
    const bannerY = attract ? playerY + 36 : vy + (playerY - vy) * 0.42
    ctx.fillText(sim.banner, cx, bannerY)
    if (sim.bannerSub) {
      ctx.font = "500 12px 'IBM Plex Mono', ui-monospace, monospace"
      ctx.fillStyle = PALETTE.amber
      ctx.fillText(sim.bannerSub, cx, bannerY + 22)
    }
    ctx.globalAlpha = 1
  }

  if (sim.invertT > 0) {
    ctx.strokeStyle = `rgba(255,178,10,${0.35 + Math.sin(sim.time * 16) * 0.15})`
    ctx.lineWidth = 3
    ctx.strokeRect(8, top + 4, w - 16, bottom - top - 8)
  }

  if (!attract && sim.phase !== "dead" && sim.phase !== "won") {
    ctx.strokeStyle = heat > 0.55 ? "rgba(255,178,10,0.55)" : "rgba(61,255,138,0.45)"
    ctx.lineWidth = 2
    const arm = Math.max(16, Math.min(28, w * 0.04))
    const x0 = 12
    const x1 = w - 12
    const y0 = top + 8
    const y1 = bottom - 8
    const mark = (x: number, y: number, dx: number, dy: number) => {
      ctx.beginPath()
      ctx.moveTo(x, y + dy * arm)
      ctx.lineTo(x, y)
      ctx.lineTo(x + dx * arm, y)
      ctx.stroke()
    }
    mark(x0, y0, 1, 1)
    mark(x1, y0, -1, 1)
    mark(x0, y1, 1, -1)
    mark(x1, y1, -1, -1)
  }

  const vignette = ctx.createRadialGradient(cx, h * 0.45, h * 0.2, cx, h * 0.5, h * 0.72)
  vignette.addColorStop(0, "rgba(0,0,0,0)")
  vignette.addColorStop(1, "rgba(0,0,0,0.55)")
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  if (sim.phase === "dead") {
    ctx.fillStyle = `rgba(3,8,6,${Math.min(0.72, sim.endT * 0.45)})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
}
