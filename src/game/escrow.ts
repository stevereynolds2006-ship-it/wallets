import type { FriendWalletProvider } from "@rarefriends/friendsdk/wallet"
import { createWalletClient, custom, parseAbi, type Address, type Hex } from "viem"
import { RF_TOKEN, STAKE, rfReader, robinhood } from "./coins"

/**
 * Paste the deployed WalletsDiveEscrow address here.
 * Until it is set, a connected dive still sends 25 RF straight to the sink.
 */
export const ESCROW: Address | null = null

const abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function stake(bytes32 diveId)",
  "function relay(bytes32 diveId, bool won, uint256 deadline, bytes signature)",
])

const PENDING_KEY = "wallets-escrow-pending"

export type PendingDive = {
  diveId: Hex
  player: Address
  won: boolean
  escrow: Address
}

export function newDiveId(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex
}

async function confirmed(opts: {
  account: Address
  provider: FriendWalletProvider
  address: Address
  functionName: "approve" | "stake" | "relay"
  args: readonly [Address, bigint] | readonly [Hex] | readonly [Hex, boolean, bigint, Hex]
}): Promise<Hex> {
  const wallet = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport: custom(opts.provider),
  })
  const hash = await wallet.writeContract({
    account: opts.account,
    chain: robinhood,
    address: opts.address,
    abi,
    functionName: opts.functionName,
    args: opts.args,
  })
  const receipt = await rfReader.waitForTransactionReceipt({ hash, confirmations: 1 })
  if (receipt.status !== "success") throw new Error("The game wallet transaction reverted.")
  return hash
}

/** Approve 25 RF if needed, then stake it under a fresh dive id. Two prompts the first time, one after. */
export async function stakeDive(opts: { account: Address; provider: FriendWalletProvider }): Promise<Hex> {
  if (!ESCROW) throw new Error("The game wallet is not deployed yet.")
  const allowance = await rfReader.readContract({
    address: RF_TOKEN,
    abi,
    functionName: "allowance",
    args: [opts.account, ESCROW],
  })
  if (allowance < STAKE) {
    await confirmed({
      ...opts,
      address: RF_TOKEN,
      functionName: "approve",
      args: [ESCROW, STAKE],
    })
  }
  const diveId = newDiveId()
  await confirmed({
    ...opts,
    address: ESCROW,
    functionName: "stake",
    args: [diveId],
  })
  return diveId
}

/** Submit a settler signature. The page never signs this itself. */
export async function relaySettlement(opts: {
  account: Address
  provider: FriendWalletProvider
  diveId: Hex
  won: boolean
  deadline: bigint
  signature: Hex
}): Promise<Hex> {
  if (!ESCROW) throw new Error("The game wallet is not deployed yet.")
  return confirmed({
    account: opts.account,
    provider: opts.provider,
    address: ESCROW,
    functionName: "relay",
    args: [opts.diveId, opts.won, opts.deadline, opts.signature],
  })
}

export function rememberDive(dive: PendingDive): void {
  const prior = readPending()
  const next = [...prior.filter((row) => row.diveId !== dive.diveId), dive].slice(-20)
  localStorage.setItem(PENDING_KEY, JSON.stringify(next))
}

export function readPending(): PendingDive[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as PendingDive[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
