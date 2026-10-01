/**
 * Sign a WALLETS settlement off the website. The settler key stays in this shell, never in the page.
 *
 *   SETTLER_PK=0x... CONTRACT=0x... DIVE_ID=0x... PLAYER=0x... WON=true DEADLINE=1893456000 \
 *     node contracts/sign-settle.mjs
 *
 * Paste the printed signature into escrow.relay(diveId, won, deadline, signature).
 */
import { getAddress, hashTypedData, isHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const pk = process.env.SETTLER_PK
const contract = process.env.CONTRACT
const diveId = process.env.DIVE_ID
const player = process.env.PLAYER
const won = process.env.WON === "true"
const deadline = BigInt(process.env.DEADLINE ?? Math.floor(Date.now() / 1000) + 3600)

if (!pk || !contract || !diveId || !player) {
  console.error("Need SETTLER_PK, CONTRACT, DIVE_ID, PLAYER, and WON=true|false")
  process.exit(1)
}
if (!isHex(diveId) || diveId.length !== 66) {
  console.error("DIVE_ID must be a 32-byte hex string")
  process.exit(1)
}

const account = privateKeyToAccount(pk)
const signature = await account.signTypedData({
  domain: {
    name: "WALLETS",
    version: "1",
    chainId: 4663,
    verifyingContract: getAddress(contract),
  },
  types: {
    Settle: [
      { name: "diveId", type: "bytes32" },
      { name: "player", type: "address" },
      { name: "won", type: "bool" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Settle",
  message: { diveId, player: getAddress(player), won, deadline },
})

console.log(JSON.stringify({ settler: account.address, diveId, player: getAddress(player), won, deadline: deadline.toString(), signature, digestCheck: hashTypedData({
  domain: { name: "WALLETS", version: "1", chainId: 4663, verifyingContract: getAddress(contract) },
  types: { Settle: [
    { name: "diveId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "won", type: "bool" },
    { name: "deadline", type: "uint256" },
  ] },
  primaryType: "Settle",
  message: { diveId, player: getAddress(player), won, deadline },
}) }, null, 2))
