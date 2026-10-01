import { RF } from "@rarefriends/friendsdk/game"
import type { FriendWalletProvider } from "@rarefriends/friendsdk/wallet"
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem"

/** Canonical $RAREFRIENDS and Generations contracts on Robinhood Chain. */
export const RF_TOKEN: Address = "0x0779369854d3EcdEA927206718FFD7730C67B71f"
export const GENERATIONS: Address = "0x14C49e6118F46525dE9ab41a51cBAA3c6EBF181D"
export const COIN = 10n * RF

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
})

const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function tokenBoundAccount(uint256) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
])

const reader = createPublicClient({
  chain: robinhood,
  transport: http(robinhood.rpcUrls.default.http[0]),
})

export async function readRareBalance(account: Address): Promise<bigint> {
  return reader.readContract({ address: RF_TOKEN, abi, functionName: "balanceOf", args: [account] })
}

/** Wallet-confirmed transfer of 10 RF into the selected Friend's own wallet. */
export async function payRareCoin(opts: {
  account: Address
  friendId: bigint
  provider: FriendWalletProvider
}): Promise<Hex> {
  const recipient = await reader.readContract({
    address: GENERATIONS,
    abi,
    functionName: "tokenBoundAccount",
    args: [opts.friendId],
  })
  if (!isAddress(recipient) || recipient === zeroAddress) throw new Error("This Friend has no wallet to pay.")
  const wallet = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport: custom(opts.provider),
  })
  const hash = await wallet.writeContract({
    account: opts.account,
    chain: robinhood,
    address: RF_TOKEN,
    abi,
    functionName: "transfer",
    args: [recipient, COIN],
  })
  const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 1 })
  if (receipt.status !== "success") throw new Error("The RF payment reverted.")
  return hash
}
