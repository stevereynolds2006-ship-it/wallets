import { RF } from "@rarefriends/friendsdk/game"
import type { FriendWalletProvider } from "@rarefriends/friendsdk/wallet"
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem"

/** Canonical $RAREFRIENDS token on Robinhood Chain. */
export const RF_TOKEN: Address = getAddress("0x0779369854d3EcdEA927206718FFD7730C67B71f")
/** A failed dive sends the play fee here. A clear run does not. */
export const SINK: Address = getAddress("0xb7823b2e28484382aa70952a7818712e8ac42a72")
export const COIN = 25n * RF

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
})

const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
])

const reader = createPublicClient({
  chain: robinhood,
  transport: http(robinhood.rpcUrls.default.http[0]),
})

export async function readRareBalance(account: Address): Promise<bigint> {
  return reader.readContract({ address: RF_TOKEN, abi, functionName: "balanceOf", args: [account] })
}

/** Wallet-confirmed transfer of 25 RF. Used when a connected dive fails. */
export async function payRareCoin(opts: {
  account: Address
  provider: FriendWalletProvider
  to: Address
}): Promise<Hex> {
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
    args: [opts.to, COIN],
  })
  const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 1 })
  if (receipt.status !== "success") throw new Error("The RF payment reverted.")
  return hash
}
