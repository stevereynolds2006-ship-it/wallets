import {
  RF,
  expectedReward,
  outcomeForRoll,
  parseChanceGame,
  samplePreviewRoll,
  createGamePreview,
  type ChanceGameDefinition,
  type GameSnapshot,
} from "@rarefriends/friendsdk/game"
import gameJson from "./game.json" with { type: "json" }

/** Whole RF the Friend starts with. Pocket coins add more. Burns spend it. */
export const STIPEND_RF = 22

/**
 * House stake + shadow balance so the official preview client can settle every
 * capsule. The number the player sees is `wallet`, not this seed.
 */
const SHADOW_RF = 4000n * RF

export const SHADOW_START = SHADOW_RF

export const definition: ChanceGameDefinition = parseChanceGame(gameJson)

export const EXPECTED_LABEL = formatRf(expectedReward(definition))

export type BurnResult = {
  name: string
  rebate: number
}

export type Economy = {
  readonly definition: ChanceGameDefinition
  wallet: number
  burned: number
  returned: number
  collected: number
  drips: number
  sdkBurns: number
  fault: string
  collect: (amount: number) => void
  burn: () => BurnResult | null
  snapshot: () => Promise<GameSnapshot>
}

function hush(p: Promise<unknown>, econ: Economy, label: string) {
  p.catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "ledger failed"
    econ.fault = `${label}: ${message}`
  })
}

export function createEconomy(opts?: { roll?: () => number; friendId?: bigint }): Economy {
  let roll = 0
  const preview = createGamePreview(definition, {
    stake: SHADOW_RF,
    rfBalance: SHADOW_RF,
    friendId: opts?.friendId ?? 1n,
    draw: () => roll,
  })
  let plays = 0
  const rollOf = opts?.roll ?? samplePreviewRoll

  const econ: Economy = {
    definition,
    wallet: STIPEND_RF,
    burned: 0,
    returned: 0,
    collected: 0,
    drips: 0,
    sdkBurns: 0,
    fault: "",
    collect(amount) {
      if (amount <= 0) return
      econ.wallet += amount
      econ.collected += amount
    },
    burn() {
      if (econ.wallet < 1) return null
      roll = rollOf()
      const outcomeId = outcomeForRoll(definition, roll)
      const outcome = definition.outcomes[outcomeId - 1]
      if (!outcome) return null
      const rebate = Number(outcome.reward / RF)
      econ.wallet = econ.wallet - 1 + rebate
      econ.burned += 1
      econ.returned += rebate
      if (outcome.name === "Drip") econ.drips += 1

      // Same order as the live client: buy → play → settle → redeem.
      // These preview methods mutate synchronously; the promises only surface errors.
      plays += 1
      hush(preview.client.buy(1n), econ, "buy")
      hush(preview.client.play(1n), econ, "play")
      hush(preview.client.settle(BigInt(plays)), econ, "settle")
      if (rebate > 0) hush(preview.client.redeem(outcomeId, 1n), econ, "redeem")
      econ.sdkBurns += 1
      return { name: outcome.name, rebate }
    },
    snapshot: () => preview.client.read(),
  }
  return econ
}

export function formatRf(value: bigint, digits = 2) {
  const neg = value < 0n
  const abs = neg ? -value : value
  const whole = abs / RF
  const frac = (abs % RF).toString().padStart(18, "0").slice(0, digits)
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`
}

export function outcomeTable() {
  return definition.outcomes.map((outcome) => ({
    name: outcome.name,
    percent: outcome.chanceBps / 100,
    reward: Number(outcome.reward / RF),
  }))
}
