import { readGenerationEligibility } from "@rarefriends/friendsdk/identity"
import { readOwnedFriends } from "@rarefriends/friendsdk/owned"
import { createFriendReader, type GenerationSprites } from "@rarefriends/friendsdk/sprites"
import { createFriendPublicClient, type FriendWalletProvider } from "@rarefriends/friendsdk/wallet"
import type { Address } from "viem"

export type Diver = {
  id: string
  label: string
  generation: number
  family: string
  wallet: Address
  sprites: GenerationSprites
}

const reader = createFriendReader()

type Injected = FriendWalletProvider & {
  isMetaMask?: boolean
  isBraveWallet?: boolean
  isRabby?: boolean
  isPhantom?: boolean
  isCoinbaseWallet?: boolean
  isTrust?: boolean
  isOkxWallet?: boolean
  providers?: Injected[]
  _metamask?: unknown
  off?: FriendWalletProvider["removeListener"]
}

function isInjected(value: unknown): value is Injected {
  if (!value || typeof value !== "object") return false
  const provider = value as Injected
  return typeof provider.request === "function" && typeof provider.on === "function"
}

function isMetaMaskProvider(value: unknown): value is Injected {
  if (!isInjected(value)) return false
  if (value.isBraveWallet || value.isRabby || value.isPhantom || value.isCoinbaseWallet || value.isTrust || value.isOkxWallet) {
    return false
  }
  return value.isMetaMask === true || (typeof value._metamask === "object" && value._metamask !== null)
}

/** MetaMask mobile often has no removeListener. The SDK will not see it unless we wrap it. */
export function findMetaMaskProvider(): FriendWalletProvider | null {
  if (typeof window === "undefined") return null
  const ethereum = (window as Window & { ethereum?: Injected }).ethereum
  if (!ethereum) return null
  const fromList = Array.isArray(ethereum.providers) ? ethereum.providers.find(isMetaMaskProvider) : undefined
  const raw = fromList ?? (isMetaMaskProvider(ethereum) ? ethereum : isInjected(ethereum) ? ethereum : null)
  if (!raw) return null
  return {
    request: (args) => raw.request(args),
    on: (event, listener) => raw.on(event, listener),
    removeListener: (event, listener) => {
      if (typeof raw.removeListener === "function") raw.removeListener(event, listener)
      else raw.off?.(event, listener)
    },
  }
}
export function metaMaskDappUrl(): string | null {
  if (typeof window === "undefined") return null
  const { host, pathname, search } = window.location
  if (!host || host.startsWith("127.") || host === "localhost" || host.startsWith("0.0.0.0")) return null
  return `https://metamask.app.link/dapp/${host}${pathname}${search}`
}

/** Friends this wallet holds that can be the diver. Read-only. Nothing is signed or spent. */
export async function listDivers(account: Address): Promise<{ divers: Diver[]; hidden: number }> {
  const client = createFriendPublicClient()
  const owned = await readOwnedFriends(client, account)
  const ranked = [...owned.friends].sort((a, b) => a.generation - b.generation || (a.id < b.id ? -1 : 1))
  const divers: Diver[] = []
  for (const friend of ranked) {
    if (friend.generation < 1 || divers.length >= 8) continue
    const gate = await readGenerationEligibility(client, friend.id, account)
    if (!gate.eligible) continue
    const sprites = await reader.read(friend.id)
    divers.push({
      id: friend.id.toString(),
      label: friend.label,
      generation: gate.generation,
      family: sprites.familyName,
      wallet: friend.walletAddress,
      sprites,
    })
  }
  return { divers, hidden: owned.hiddenCount }
}
