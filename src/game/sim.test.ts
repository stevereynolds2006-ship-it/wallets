import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RF } from "@rarefriends/friendsdk/game"
import { SHADOW_START, createEconomy } from "./economy.ts"
import { createSim, startRun, step, type Input } from "./sim.ts"

const idle: Input = { steer: 0, pointer: null, boost: false, brake: false, burn: false }

describe("burn capsule ledger", () => {
  it("settles ash on the FriendSDK preview and sinks 1 RF", async () => {
    const econ = createEconomy({ roll: () => 0 })
    const result = econ.burn()
    assert.equal(result?.name, "Ash")
    assert.equal(result?.rebate, 0)
    assert.equal(econ.wallet, 21)
    assert.equal(econ.sdkBurns, 1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(econ.fault, "")
    const snap = await econ.snapshot()
    assert.equal(snap.mode, "preview")
    assert.equal(snap.rfBalance, SHADOW_START - RF)
    assert.equal(snap.plays.length, 1)
  })

  it("pays a drip back through redeem", async () => {
    const econ = createEconomy({ roll: () => 9600 })
    const result = econ.burn()
    assert.equal(result?.name, "Drip")
    assert.equal(result?.rebate, 3)
    assert.equal(econ.wallet, 24)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(econ.fault, "")
    const snap = await econ.snapshot()
    assert.equal(snap.rfBalance, SHADOW_START - RF + 3n * RF)
  })

  it("refuses a burn when the wallet is empty", () => {
    const econ = createEconomy({ roll: () => 0 })
    econ.wallet = 0
    assert.equal(econ.burn(), null)
    assert.equal(econ.sdkBurns, 0)
  })
})

describe("dive controls", () => {
  it("turns left when A is held while moving forward", () => {
    const sim = createSim()
    startRun(sim)
    assert.ok(sim.speed > 0.1)
    const yaw0 = sim.yaw
    const x0 = sim.x
    const input: Input = { steer: 1, pointer: null, boost: true, brake: false, burn: false }
    for (let i = 0; i < 30; i++) step(sim, input, 1 / 60)
    assert.ok(sim.yaw > yaw0 + 0.05, `yaw delta ${sim.yaw - yaw0}`)
    assert.ok(sim.x < x0, `x moved right to ${sim.x}`)
  })

  it("does not open the seal until the burn quota is met", () => {
    const sim = createSim()
    startRun(sim)
    for (let i = 0; i < 4000; i++) {
      sim.iframes = 1
      step(sim, idle, 1 / 60)
      if (sim.phase !== "play") break
    }
    assert.equal(sim.level, 0)
    assert.notEqual(sim.phase, "won")
    assert.equal(sim.burnedLevel, 0)
  })

  it("cracks strata 01 after the burn quota", () => {
    const sim = createSim()
    startRun(sim)
    const burning: Input = { steer: 0, pointer: null, boost: false, brake: false, burn: true }
    for (let i = 0; i < 5000 && sim.phase === "play" && sim.level === 0; i++) {
      sim.iframes = 1
      step(sim, burning, 1 / 60)
    }
    assert.equal(sim.phase, "seal")
    assert.ok(sim.burnedLevel >= 6)
  })
})
