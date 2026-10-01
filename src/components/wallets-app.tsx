import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Flame, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { createFriendWalletSession, type FriendWalletProvider, type FriendWalletSnapshot } from "@rarefriends/friendsdk/wallet"
import type { Address } from "viem"
import { createAudio } from "@/game/audio"
import { COIN, payRareCoin, readRareBalance } from "@/game/coins"
import { createScene, drawFrame } from "@/game/draw"
import { EXPECTED_LABEL, STIPEND_RF, formatRf, outcomeTable } from "@/game/economy"
import { listDivers, findMetaMaskProvider, metaMaskDappUrl, type Diver } from "@/game/identity"
import { LEVELS, createSim, levelOf, startRun, step, type Input, type Phase, type Sim } from "@/game/sim"
import { defaultSave, loadSave, writeSave, type Save } from "@/game/save"

type Hud = {
  phase: Phase
  layer: string
  name: string
  line: string
  wallet: number
  burned: number
  returned: number
  burnedLevel: number
  quota: number
  integrity: number
  collected: number
  score: number
  progress: number
  chain: number
  phasing: boolean
  lastBurn: string
  fault: string
  sdkBurns: number
  drips: number
  diverLabel: string
  coinText: string
}

const TABLE = outcomeTable()

function hudOf(sim: Sim): Hud {
  const level = levelOf(sim)
  const econ = sim.economy
  return {
    phase: sim.phase,
    layer: level.layer,
    name: level.name,
    line: level.line,
    wallet: econ?.wallet ?? STIPEND_RF,
    burned: econ?.burned ?? 0,
    returned: econ?.returned ?? 0,
    burnedLevel: sim.burnedLevel,
    quota: level.quota,
    integrity: sim.integrity,
    collected: econ?.collected ?? 0,
    score: sim.score,
    progress: Math.max(0, Math.min(1, sim.distance / level.length)),
    chain: sim.chain,
    phasing: sim.phaseTime > 0,
    lastBurn: sim.lastBurn,
    fault: econ?.fault ?? "",
    sdkBurns: econ?.sdkBurns ?? 0,
    drips: econ?.drips ?? 0,
    diverLabel: sim.diver ? `${sim.diver.label} · Gen ${sim.diver.generation}` : "",
    coinText: sim.coinLabel ?? String(econ?.wallet ?? STIPEND_RF),
  }
}

function readSteer(held: Set<string> | string[]) {
  const has = (code: string) => (held instanceof Set ? held.has(code) : held.includes(code))
  let steer = 0
  if (has("KeyA") || has("ArrowLeft")) steer += 1
  if (has("KeyD") || has("ArrowRight")) steer -= 1
  return Math.max(-1, Math.min(1, steer))
}

function inMetaMaskBrowser(): boolean {
  return typeof navigator !== "undefined" && /MetaMaskMobile/i.test(navigator.userAgent)
}

/** MetaMask's browser lies about 100vh, and its fullscreen button often updates late. */
function syncVisibleViewport(): void {
  const viewport = window.visualViewport
  const innerH = window.innerHeight
  let height = Math.round(viewport?.height ?? innerH)
  let top = Math.round(viewport?.offsetTop ?? 0)
  if (inMetaMaskBrowser() && innerH >= window.screen.height * 0.9 && innerH > height + 24) {
    height = innerH
    top = 0
  }
  const root = document.documentElement
  const nextH = `${Math.max(1, height)}px`
  const nextT = `${Math.max(0, top)}px`
  if (root.style.getPropertyValue("--app-h") !== nextH) root.style.setProperty("--app-h", nextH)
  if (root.style.getPropertyValue("--app-top") !== nextT) root.style.setProperty("--app-top", nextT)
}

export function WalletsApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const simRef = useRef<Sim | null>(null)
  if (!simRef.current) simRef.current = createSim()
  const keys = useRef(new Set<string>())
  const override = useRef<string[] | null>(null)
  const pointer = useRef<number | null>(null)
  const dock = useRef(0)
  const burnHeld = useRef(false)
  const reducedRef = useRef(false)
  const mutedRef = useRef(false)
  const saveRef = useRef<Save>(defaultSave())
  const [hud, setHud] = useState<Hud>(() => hudOf(simRef.current as Sim))
  const [save, setSave] = useState<Save>(defaultSave())
  const [wallet, setWallet] = useState<FriendWalletSnapshot | null>(null)
  const [divers, setDivers] = useState<Diver[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [walletNote, setWalletNote] = useState("")
  const [walletBusy, setWalletBusy] = useState(false)
  const [feeOwed, setFeeOwed] = useState(false)
  const [staked, setStaked] = useState(false)
  const [paidFor, setPaidFor] = useState<string | null>(null)
  const [dappUrl, setDappUrl] = useState<string | null>(null)
  const [inWalletBrowser, setInWalletBrowser] = useState(false)
  const sessionRef = useRef<ReturnType<typeof createFriendWalletSession> | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const bindRef = useRef<(session: ReturnType<typeof createFriendWalletSession>) => void>(() => {})
  const feeOwedRef = useRef(false)
  const lockFeeRef = useRef<() => void>(() => {})
  const payRef = useRef<{ account: Address; friendId: bigint; provider: FriendWalletProvider } | null>(null)
  const audioRef = useRef<ReturnType<typeof createAudio> | null>(null)

  useEffect(() => {
    const loaded = loadSave()
    saveRef.current = loaded
    setSave(loaded)
    mutedRef.current = loaded.muted
    const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    reducedRef.current = loaded.reduced ?? systemReduced
  }, [])

  useEffect(() => {
    syncVisibleViewport()
    const viewport = window.visualViewport
    viewport?.addEventListener("resize", syncVisibleViewport)
    viewport?.addEventListener("scroll", syncVisibleViewport)
    window.addEventListener("resize", syncVisibleViewport)
    window.addEventListener("orientationchange", syncVisibleViewport)
    window.addEventListener("focus", syncVisibleViewport)
    const timer = window.setInterval(syncVisibleViewport, inMetaMaskBrowser() ? 250 : 1000)
    return () => {
      viewport?.removeEventListener("resize", syncVisibleViewport)
      viewport?.removeEventListener("scroll", syncVisibleViewport)
      window.removeEventListener("resize", syncVisibleViewport)
      window.removeEventListener("orientationchange", syncVisibleViewport)
      window.removeEventListener("focus", syncVisibleViewport)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!feeOwed) return
    const stay = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const holdBack = () => {
      history.pushState({ walletsFee: 1 }, "")
    }
    history.pushState({ walletsFee: 1 }, "")
    window.addEventListener("beforeunload", stay)
    window.addEventListener("popstate", holdBack)
    return () => {
      window.removeEventListener("beforeunload", stay)
      window.removeEventListener("popstate", holdBack)
    }
  }, [feeOwed])

  useEffect(() => {
    const bind = (session: ReturnType<typeof createFriendWalletSession>) => {
      stopRef.current?.()
      const previous = sessionRef.current
      if (previous && previous !== session) previous.dispose()
      sessionRef.current = session
      setWallet(session.getSnapshot())
      stopRef.current = session.subscribe(() => {
        const snap = session.getSnapshot()
        setWallet(snap)
        if (!snap.account) {
          if (feeOwedRef.current) return
          setDivers([])
          setPicked(null)
          payRef.current = null
          const sim = simRef.current
          if (sim) {
            sim.diver = null
            sim.coinLabel = null
          }
        }
      })
    }
    bindRef.current = bind
    bind(createFriendWalletSession())
    setDappUrl(metaMaskDappUrl())
    setInWalletBrowser(inMetaMaskBrowser())
    return () => {
      stopRef.current?.()
      stopRef.current = null
      sessionRef.current?.dispose()
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas || !sim) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const scene = createScene()
    const audio = createAudio()
    audioRef.current = audio
    audio.setMuted(mutedRef.current)
    let alive = true
    let raf = 0
    let last = performance.now()
    let acc = 0
    let hudAt = 0
    let settledPhase: Phase = sim.phase

    const commitRun = () => {
      const econ = sim.economy
      if (!econ) return
      const prev = saveRef.current
      const net = econ.burned - econ.returned
      const next: Save = {
        ...prev,
        runs: prev.runs + 1,
        lifetimeBurns: prev.lifetimeBurns + econ.burned,
        lifetimeNet: prev.lifetimeNet + net,
        bestScore: Math.max(prev.bestScore, sim.score),
        bestNet: Math.max(prev.bestNet, net),
      }
      saveRef.current = next
      writeSave(next)
      setSave(next)
    }

    const fx = {
      coin: () => audio.coin(),
      burn: () => audio.burn(),
      hit: () => audio.hit(),
      seal: () => audio.seal(),
      deny: () => audio.deny(),
      win: () => audio.win(),
      die: () => audio.hit(),
    }

    const inputOf = (): Input => {
      const held = override.current ?? keys.current
      let steer = readSteer(held) + dock.current
      if (override.current) steer = readSteer(override.current)
      steer = Math.max(-1, Math.min(1, steer))
      const has = (code: string) => (held instanceof Set ? held.has(code) : held.includes(code))
      return {
        steer,
        pointer: override.current ? null : pointer.current,
        boost: has("KeyW") || has("ArrowUp"),
        brake: has("KeyS") || has("ArrowDown"),
        burn: burnHeld.current || has("Space") || has("KeyK"),
      }
    }

    const paint = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const playing = sim.phase === "play" || sim.phase === "seal" || sim.phase === "pause"
      drawFrame(ctx, scene, sim, w, h, reducedRef.current, {
        top: playing ? 156 * dpr : 0,
        bottom: playing ? 120 * dpr : 0,
      })
    }

    const loop = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (sim.phase !== "pause") sim.time += dt
      if (sim.phase === "dead" || sim.phase === "won") sim.endT += dt
      const input = inputOf()
      if (sim.phase === "play" || sim.phase === "seal") {
        acc += dt
        let guard = 0
        while (acc >= 1 / 60 && guard++ < 5) {
          step(sim, input, 1 / 60, fx)
          acc -= 1 / 60
        }
      }
      if ((sim.phase === "dead" || sim.phase === "won") && settledPhase !== sim.phase) commitRun()
      settledPhase = sim.phase
      const level = levelOf(sim)
      audio.setMuted(mutedRef.current)
      audio.setDrive(sim.level / 4, sim.speed, sim.phaseTime > 0)
      paint()
      if (now - hudAt > 80) {
        hudAt = now
        setHud(hudOf(sim))
      }
      void level
      raf = requestAnimationFrame(loop)
    }

    const down = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault()
      keys.current.add(e.code)
      if (e.code === "Escape" && (sim.phase === "play" || sim.phase === "pause")) {
        sim.phase = sim.phase === "pause" ? "play" : "pause"
        setHud(hudOf(sim))
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    const onHide = () => {
      if (document.hidden) keys.current.clear()
    }
    document.addEventListener("visibilitychange", onHide)

    if (import.meta.env.DEV) {
      window.__controlsTest = {
        getYaw: () => sim.yaw,
        getSpeed: () => sim.speed,
        setSteer: (v) => {
          dock.current = v
        },
        setKeys: (codes) => {
          override.current = codes
          dock.current = 0
          pointer.current = null
          burnHeld.current = false
        },
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      document.removeEventListener("visibilitychange", onHide)
      if (import.meta.env.DEV) delete window.__controlsTest
      audio.dispose()
      audioRef.current = null
    }
  }, [])

  const syncPay = (account: Address | null, friendId: string | null) => {
    const provider = sessionRef.current?.getProvider() ?? findMetaMaskProvider()
    const sim = simRef.current
    if (!account || !friendId || !provider) {
      payRef.current = null
      if (sim) sim.coinLabel = null
      return
    }
    payRef.current = { account, friendId: BigInt(friendId), provider }
    void readRareBalance(account)
      .then((bal) => {
        const live = simRef.current
        if (!live || payRef.current?.account !== account) return
        live.coinLabel = formatRf(bal)
        setHud(hudOf(live))
      })
      .catch(() => {
        const live = simRef.current
        if (live && payRef.current?.account === account) live.coinLabel = "—"
      })
  }

  const payUpfront = async (diver: Diver) => {
    const account = wallet?.account
    const provider = sessionRef.current?.getProvider() ?? findMetaMaskProvider()
    if (!account || !provider) {
      setWalletNote("Connect the wallet that holds this Friend. Pay 25 RF before the dive.")
      return
    }
    lockFeeRef.current()
    setWalletBusy(true)
    setWalletNote("")
    try {
      const bal = await readRareBalance(account)
      if (bal < COIN) {
        setWalletNote("Need 25 RF in this wallet before the dive can start.")
        return
      }
      if (!diver.wallet || diver.wallet === "0x0000000000000000000000000000000000000000") {
        setWalletNote("This Friend has no wallet to receive the 25 RF.")
        return
      }
      setWalletNote("Confirm 25 RF into this Friend's wallet. The dive stays locked until it lands.")
      await payRareCoin({ account, provider, to: diver.wallet, amount: COIN })
      setPaidFor(diver.id)
      setStaked(true)
      setWalletNote("25 RF is in this Friend's wallet. Tap Dive to start.")
    } catch (error) {
      const declined = typeof error === "object" && error !== null && "code" in error && error.code === 4001
      setPaidFor(null)
      setStaked(false)
      setWalletNote(declined ? "Payment declined. The dive has not started." : error instanceof Error ? error.message.slice(0, 160) : "Payment failed.")
    } finally {
      feeOwedRef.current = false
      setFeeOwed(false)
      setWalletBusy(false)
    }
  }

  const begin = async () => {
    const sim = simRef.current
    if (!sim || walletBusy || feeOwedRef.current) return
    audioRef.current?.unlock()
    const diver = divers.find((friend) => friend.id === picked) ?? null
    if (diver && paidFor !== diver.id) {
      await payUpfront(diver)
      return
    }
    setPaidFor(null)
    if (!diver) setStaked(false)
    sim.diver = diver
    startRun(sim, diver ? BigInt(diver.id) : undefined)
    if (diver) sim.diver = diver
    syncPay(wallet?.account ?? null, diver?.id ?? null)
    setHud(hudOf(sim))
  }
  lockFeeRef.current = () => {
    feeOwedRef.current = true
    setFeeOwed(true)
  }

  const disconnectWallet = () => {
    if (feeOwedRef.current) return
    sessionRef.current?.disconnect()
    setDivers([])
    setPicked(null)
    setPaidFor(null)
    setWalletNote("")
    setStaked(false)
    payRef.current = null
    const sim = simRef.current
    if (sim) {
      sim.diver = null
      sim.coinLabel = null
    }
    const snap = sessionRef.current?.getSnapshot()
    if (snap) setWallet(snap)
    if (sim) setHud(hudOf(sim))
  }

  const connectWallet = async () => {
    if (walletBusy) return
    setWalletBusy(true)
    setWalletNote("")
    try {
      const injected = findMetaMaskProvider()
      let session = sessionRef.current
      const named = session?.getSnapshot().wallets.find((choice) => /meta ?mask/i.test(choice.name))
      if (!named && injected) {
        const next = createFriendWalletSession({ provider: injected })
        bindRef.current(next)
        session = next
      }
      if (!session || (!named && !injected)) {
        const url = metaMaskDappUrl()
        if (url && !inMetaMaskBrowser()) {
          window.location.assign(url)
          return
        }
        setWalletNote(
          inMetaMaskBrowser()
            ? "MetaMask is open, but it didn't hand over the wallet. Tap Connect wallet again."
            : "Open the MetaMask app and load this page in its browser, then tap Connect wallet.",
        )
        return
      }
      let snap = await session.connect(named?.id)
      if (snap.status === "wrong-network") snap = await session.switchNetwork()
      setWallet(snap)
      if (snap.status !== "connected" || !snap.account) {
        setWalletNote(snap.error ?? "Wallet did not connect.")
        return
      }
      const found = await listDivers(snap.account)
      setDivers(found.divers)
      const first = found.divers[0] ?? null
      setPicked(first?.id ?? null)
      const sim = simRef.current
      if (sim) sim.diver = first
      syncPay(snap.account, first?.id ?? null)
      if (!first) setWalletNote("No eligible Generations NFT in this wallet. It has to be hardwired, generation 1 or higher.")
      else if (found.hidden > 0) setWalletNote(`${found.hidden} Friends stayed hidden by the contract.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read this wallet."
      setWalletNote(message.slice(0, 180))
    } finally {
      setWalletBusy(false)
    }
  }

  const toggleMute = () => {
    const next = { ...saveRef.current, muted: !saveRef.current.muted }
    saveRef.current = next
    mutedRef.current = next.muted
    writeSave(next)
    setSave(next)
  }

  const toggleMotion = () => {
    const nextReduced = !reducedRef.current
    reducedRef.current = nextReduced
    const next = { ...saveRef.current, reduced: nextReduced }
    saveRef.current = next
    writeSave(next)
    setSave(next)
  }

  const playing = hud.phase === "play" || hud.phase === "seal" || hud.phase === "pause"
  const needsPay = Boolean(picked && paidFor !== picked)
  const pickedFriend = divers.find((friend) => friend.id === picked) ?? null
  const net = hud.burned - hud.returned
  const showOverlay = hud.phase === "menu" || hud.phase === "dead" || hud.phase === "won" || hud.phase === "pause"

  const pointFrom = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const n = ((clientX - rect.left) / rect.width - 0.5) * 2.1
    pointer.current = Math.max(-1.08, Math.min(1.08, n))
  }

  return (
    <div className="stage bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          if (!playing || hud.phase === "pause") return
          canvasRef.current?.setPointerCapture(e.pointerId)
          pointFrom(e.clientX)
        }}
        onPointerMove={(e) => {
          if (pointer.current === null) return
          pointFrom(e.clientX)
        }}
        onPointerUp={() => {
          pointer.current = null
        }}
        onPointerCancel={() => {
          pointer.current = null
        }}
      />

      {playing && (
        <header className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-bg via-bg/80 to-transparent px-3 pb-6">
          <div className="flex items-start justify-between gap-3 pt-1">
            <div>
              <p className="font-sans text-xs tracking-widest text-primary">STRATA {hud.layer}</p>
              <h1 className="font-display text-4xl leading-none text-fg drop-shadow-[0_0_12px_rgba(61,255,138,0.35)]">{hud.name}</h1>
              {hud.diverLabel ? <p className="font-sans text-xs text-accent">{hud.diverLabel}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <p className="border border-border bg-surface/80 px-2 py-1 text-right font-sans text-xs text-muted">
                <span className="block tracking-widest text-accent">RF</span>
                <span className="font-display text-4xl leading-none text-fg">{hud.coinText}</span>
              </p>
              <button
                type="button"
                className="pointer-events-auto grid h-11 w-11 place-items-center border border-border bg-surface/90 text-fg"
                onClick={toggleMute}
                aria-label={save.muted ? "Unmute" : "Mute"}
                aria-pressed={save.muted}
              >
                {save.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                type="button"
                className="pointer-events-auto grid h-11 w-11 place-items-center border border-border bg-surface/90 text-fg"
                onClick={() => {
                  const sim = simRef.current
                  if (!sim) return
                  sim.phase = sim.phase === "pause" ? "play" : "pause"
                  setHud(hudOf(sim))
                }}
                aria-label="Pause"
              >
                <Pause size={18} />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 font-sans text-xs text-muted">
            <span className="flex gap-1" aria-label={`${hud.integrity} integrity`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < hud.integrity ? "h-2 w-7 bg-primary shadow-[0_0_8px_rgba(61,255,138,0.8)]" : "h-2 w-7 bg-border"} />
              ))}
            </span>
            <span>
              {hud.chain > 1 ? `CHAIN ${hud.chain}` : "POCKET"}
              {hud.lastBurn ? ` · ${hud.lastBurn.toUpperCase()}` : ""}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex justify-between font-sans text-[10px] tracking-widest text-muted">
                <span>SEAL</span>
                <span>{hud.burnedLevel}/{hud.quota}</span>
              </div>
              <div className="h-1.5 w-full bg-border" aria-hidden>
                <div className="h-full bg-accent shadow-[0_0_8px_rgba(255,178,10,0.7)]" style={{ width: `${Math.min(100, (hud.burnedLevel / hud.quota) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between font-sans text-[10px] tracking-widest text-muted">
                <span>DEPTH</span>
                <span>{Math.round(hud.progress * 100)}</span>
              </div>
              <div className="h-1 w-full bg-border" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${hud.progress * 100}%` }} />
              </div>
            </div>
          </div>
          <p className="mt-2 font-sans text-[10px] tracking-widest text-muted">BURNS STAY SIMULATED</p>
        </header>
      )}

      {playing && hud.phase !== "pause" && (
        <div className="safe-bottom absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-bg via-bg/75 to-transparent px-3 pt-8">
          <div className="flex items-end gap-2">
          <button
            type="button"
            className="grid h-16 w-16 place-items-center border border-border bg-surface/90 text-fg"
            aria-label="Steer left"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              dock.current = 1
            }}
            onPointerUp={() => {
              dock.current = 0
            }}
            onPointerCancel={() => {
              dock.current = 0
            }}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className={
              "flex h-16 flex-1 items-center justify-center gap-2 border border-accent bg-accent font-display text-3xl tracking-wide text-bg shadow-[0_0_24px_rgba(255,178,10,0.35)]" +
              (hud.phasing ? " wallets-hot" : "")
            }
            aria-label="Burn one RF capsule"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              burnHeld.current = true
            }}
            onPointerUp={() => {
              burnHeld.current = false
            }}
            onPointerCancel={() => {
              burnHeld.current = false
            }}
          >
            <Flame size={20} />
            BURN
          </button>
          <button
            type="button"
            className="grid h-16 w-16 place-items-center border border-border bg-surface/90 text-fg"
            aria-label="Steer right"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              dock.current = -1
            }}
            onPointerUp={() => {
              dock.current = 0
            }}
            onPointerCancel={() => {
              dock.current = 0
            }}
          >
            <ChevronRight />
          </button>
          </div>
        </div>
      )}

      {showOverlay && (
        <div className="safe-bottom absolute inset-0 z-20 flex flex-col justify-end p-4">
          <section
            className={
              "sheet overflow-auto border bg-surface/95 p-4 " +
              (hud.phase === "dead" && feeOwed
                ? "border-accent shadow-[0_0_36px_rgba(255,178,10,0.22)]"
                : "border-primary/40 shadow-[0_0_36px_rgba(61,255,138,0.14)]")
            }
          >
            <div className={"mb-3 h-1 w-14 " + (hud.phase === "dead" && feeOwed ? "bg-accent" : "bg-primary")} />
            {hud.phase === "menu" && (
              <>
                <p className="font-sans text-xs tracking-widest text-primary">RARE FRIENDS · VIBEATHON</p>
                <h1 className="font-display text-7xl leading-none text-fg drop-shadow-[0_0_16px_rgba(61,255,138,0.4)]">WALLETS</h1>
                <p className="mt-1 font-display text-2xl tracking-wide text-accent">SIMULATION DIVE</p>
                <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-muted">
                  Fly through five levels as your Rare Friend. Pay 25 RF into that NFT's wallet first, then dive. Coins you burn during the run are simulated. No wallet? Start free as the stand-in.
                </p>
                {wallet?.account ? (
                  <>
                    <p className="mt-4 font-sans text-xs text-muted">
                      {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
                      {inWalletBrowser ? " · MetaMask" : ""}
                    </p>
                    <button
                      type="button"
                      className="mt-2 flex h-14 w-full items-center justify-center border border-border font-sans text-xs text-fg"
                      onClick={disconnectWallet}
                    >
                      Disconnect wallet
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="mt-4 flex h-14 w-full items-center justify-center bg-primary font-display text-3xl tracking-wide text-bg"
                    onClick={() => void connectWallet()}
                    disabled={walletBusy}
                  >
                    {walletBusy ? "Reading wallet" : "Connect wallet"}
                  </button>
                )}
                {!wallet?.account && dappUrl && !inWalletBrowser ? (
                  <a href={dappUrl} className="mt-2 block font-sans text-xs text-accent">
                    Open in the MetaMask app
                  </a>
                ) : null}
                {walletNote ? <p className="mt-2 font-sans text-xs text-accent">{walletNote}</p> : null}
                {picked ? (
                  <p className="mt-3 max-w-md font-sans text-xs leading-relaxed text-accent">
                    Pay 25 RF to {pickedFriend ? `${pickedFriend.wallet.slice(0, 6)}…${pickedFriend.wallet.slice(-4)}` : "this Friend"}, this Friend's wallet, before the dive can start. It stays there. Nothing starts until that payment confirms.
                  </p>
                ) : (
                  <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-muted">
                    Connect to dive as your Generations NFT and pay burns with RF. Or start as the stand-in on
                    simulated coins.
                  </p>
                )}
                {divers.length > 0 ? (
                  <ul className="mt-3 grid gap-2">
                    {divers.map((friend) => (
                      <li key={friend.id}>
                        <button
                          type="button"
                          className={
                            "h-14 w-full border px-3 text-left font-sans text-xs text-fg " +
                            (picked === friend.id ? "border-primary" : "border-border")
                          }
                          aria-pressed={picked === friend.id}
                          onClick={() => {
                            setPicked(friend.id)
                            const sim = simRef.current
                            if (sim) sim.diver = friend
                            syncPay(wallet?.account ?? null, friend.id)
                          }}
                        >
                          {friend.label}
                          <span className="block text-muted">
                            Gen {friend.generation} · {friend.family}
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className={
                          "h-14 w-full border px-3 text-left font-sans text-xs text-fg " +
                          (picked ? "border-border" : "border-primary")
                        }
                        aria-pressed={!picked}
                        onClick={() => {
                          setPicked(null)
                          const sim = simRef.current
                          if (sim) {
                            sim.diver = null
                            sim.coinLabel = null
                          }
                          syncPay(wallet?.account ?? null, null)
                        }}
                      >
                        STAND-IN
                        <span className="block text-muted">Dive without your NFT</span>
                      </button>
                    </li>
                  </ul>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="h-14 min-w-40 flex-1 bg-primary px-6 font-display text-3xl tracking-wide text-bg disabled:opacity-40" onClick={() => void begin()} disabled={walletBusy || feeOwed}>
                    {walletBusy ? "PAYING…" : needsPay ? "PAY 25 RF" : picked ? "DIVE" : "START"}
                  </button>
                  <button type="button" className="h-14 border border-border px-4 font-sans text-xs text-fg" onClick={toggleMute} aria-pressed={save.muted}>
                    {save.muted ? "SOUND OFF" : "SOUND ON"}
                  </button>
                  <button
                    type="button"
                    className="h-14 border border-border px-4 font-sans text-xs text-fg"
                    onClick={toggleMotion}
                    aria-pressed={reducedRef.current}
                  >
                    {reducedRef.current ? "MOTION LOW" : "MOTION FULL"}
                  </button>
                </div>
                <p className="mt-3 font-sans text-xs tracking-widest text-accent">
                  SIMULATED · FRIENDSDK 0.1.4 PREVIEW · NOT A SIGNATURE
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 font-sans text-xs text-fg">
                  {TABLE.map((row) => (
                    <li key={row.name} className="border border-border px-2 py-1.5">
                      <span className="text-primary">{row.percent}%</span> {row.name}
                      <span className="block text-muted">{row.reward === 0 ? "burns clean" : `+${row.reward} RF back`}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-sans text-xs text-muted">
                  Capsule price 1 RF. Expected return {EXPECTED_LABEL} RF. You start with {STIPEND_RF}. Drag the
                  void, or A and D. W boosts. Space burns.
                </p>
                {save.runs > 0 && (
                  <p className="mt-2 font-sans text-xs text-fg">
                    Lifetime burn {save.lifetimeBurns} · net sink {save.lifetimeNet} · best {save.bestScore}
                  </p>
                )}
              </>
            )}

            {hud.phase === "pause" && (
              <>
                <p className="font-sans text-xs tracking-widest text-primary">PAUSED</p>
                <h2 className="font-display text-5xl leading-none">HOLD THE DIVE</h2>
                <p className="mt-2 font-sans text-sm text-muted">{hud.line}</p>
                <button
                  type="button"
                  className="mt-4 flex h-14 w-full items-center justify-center gap-2 bg-primary font-display text-3xl text-bg"
                  onClick={() => {
                    const sim = simRef.current
                    if (!sim) return
                    sim.phase = "play"
                    setHud(hudOf(sim))
                  }}
                >
                  <Play size={20} />
                  Resume
                </button>
              </>
            )}

            {(hud.phase === "dead" || hud.phase === "won") && (
              <>
                <p className="font-sans text-xs tracking-widest text-accent">
                  {hud.phase === "won" ? "HORIZON FED" : "SIMULATION COLLAPSED"}
                </p>
                <h2 className="font-display text-6xl leading-none">{hud.phase === "won" ? "JACKED OUT" : "ASHED"}</h2>
                <p className="mt-2 font-sans text-sm text-muted">
                  {hud.phase === "won"
                    ? staked
                      ? "Five strata down. The 25 RF is in this Friend's wallet."
                      : "Five strata down. Gargantua kept what you burned. No RF left this wallet."
                    : staked
                      ? "The dive failed. The 25 RF already went to this Friend's wallet."
                      : "The code closed on WALLETS. The burn still counts."}
                </p>
                {walletNote && (hud.phase === "dead" || hud.phase === "won") ? (
                  <p className="mt-2 font-sans text-xs text-accent">{walletNote}</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-2 font-sans text-sm">
                  <div className="border border-border p-2">
                    <dt className="text-xs text-muted">BURNED</dt>
                    <dd className="font-display text-3xl">{hud.burned}</dd>
                  </div>
                  <div className="border border-border p-2">
                    <dt className="text-xs text-muted">RETURNED</dt>
                    <dd className="font-display text-3xl">{hud.returned}</dd>
                  </div>
                  <div className="border border-border p-2">
                    <dt className="text-xs text-muted">NET SINK</dt>
                    <dd className="font-display text-3xl text-accent">{net}</dd>
                  </div>
                  <div className="border border-border p-2">
                    <dt className="text-xs text-muted">SCORE</dt>
                    <dd className="font-display text-3xl">{hud.score}</dd>
                  </div>
                </dl>
                <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
                  FriendSDK preview settled {hud.sdkBurns} burn capsules
                  {hud.drips ? ` · ${hud.drips} drips` : ""}. Collected {hud.collected} RF into the pocket.
                  Balances are simulated.
                </p>
                {hud.fault && <p className="mt-2 font-sans text-xs text-accent">{hud.fault}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="flex h-14 flex-1 items-center justify-center gap-2 bg-primary font-display text-3xl text-bg disabled:opacity-40"
                    onClick={() => void begin()}
                    disabled={walletBusy || feeOwed}
                  >
                    <RotateCcw size={18} />
                    {needsPay ? "PAY 25 RF" : "DIVE"}
                  </button>
                  <button
                    type="button"
                    className="h-14 border border-border px-4 font-sans text-xs text-fg disabled:opacity-40"
                    disabled={feeOwed}
                    onClick={() => {
                      if (feeOwedRef.current) return
                      const sim = simRef.current
                      if (!sim) return
                      sim.phase = "menu"
                      setHud(hudOf(sim))
                    }}
                  >
                    MENU
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {hud.phase === "play" ? `Strata ${hud.layer} ${hud.name}. Wallet ${hud.wallet}.` : hud.phase}
      </p>
    </div>
  )
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number
      getSpeed: () => number
      setSteer?: (v: number) => void
      setKeys?: (codes: string[]) => void
    }
  }
}
