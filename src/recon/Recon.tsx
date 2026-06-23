import { useCallback, useEffect, useState } from 'react'
import { getNimiq, nimToLuna, type NimiqProvider } from '../lib/nimiq.ts'
import {
  getChainId,
  getNativeBalance,
  getUsdtBalance,
  requestEvmAccounts,
  sendUsdt,
  switchToPolygon,
} from '../lib/evm.ts'
import { isSecureContextAvailable } from '../lib/id.ts'
import './recon.css'

type LogKind = 'info' | 'ok' | 'err'
interface LogEntry {
  t: string
  kind: LogKind
  msg: string
}

// Dev-only diagnostic: probes both providers + the native confirm dialogs.
// Reach it at ?recon. Kept around for on-device testing.
export function Recon() {
  const [log, setLog] = useState<LogEntry[]>([])
  const [nimAddress, setNimAddress] = useState<string | null>(null)
  const [evmAddress, setEvmAddress] = useState<string | null>(null)
  const [nimReady, setNimReady] = useState<boolean | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [polBalance, setPolBalance] = useState<string | null>(null)
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null)
  const [nimAmount, setNimAmount] = useState('1')
  const [usdtAmount, setUsdtAmount] = useState('0.01')

  const push = useCallback((kind: LogKind, msg: string) => {
    const t = new Date().toLocaleTimeString()
    setLog((prev) => [{ t, kind, msg }, ...prev].slice(0, 60))
  }, [])

  const run = useCallback(
    async (label: string, fn: () => Promise<string | void>) => {
      push('info', `▶ ${label}`)
      try {
        const result = await fn()
        push('ok', `✓ ${label}${result ? ` → ${result}` : ''}`)
      } catch (e) {
        push('err', `✗ ${label} → ${(e as Error).message ?? String(e)}`)
      }
    },
    [push],
  )

  useEffect(() => {
    push('info', `Secure context (crypto.randomUUID): ${isSecureContextAvailable()}`)
    push('info', `Nimiq Pay language: ${window.nimiqPay?.language ?? 'unknown'}`)
    push('info', `window.ethereum present: ${Boolean(window.ethereum)}`)
  }, [push])

  let nimiq: NimiqProvider | null = null
  const ensureNimiq = async () => {
    if (!nimiq) nimiq = await getNimiq()
    return nimiq
  }

  const initNimiq = () =>
    run('Init Nimiq + consensus + block', async () => {
      const n = await ensureNimiq()
      const [consensus, block] = await Promise.all([n.isConsensusEstablished(), n.getBlockNumber()])
      setNimReady(consensus)
      return `consensus=${consensus}, block=${block}`
    })

  const listNim = () =>
    run('listAccounts (NIM) — native dialog', async () => {
      const n = await ensureNimiq()
      const accounts = await n.listAccounts()
      setNimAddress(accounts[0] ?? null)
      return accounts.join(', ') || '(none)'
    })

  const signNim = () =>
    run('sign("stakes recon") — native dialog', async () => {
      const n = await ensureNimiq()
      const { signature } = await n.sign('stakes recon')
      return `sig ${signature.slice(0, 18)}…`
    })

  const sendNimToSelf = () =>
    run(`★ send ${nimAmount} NIM to self — NATIVE NIM DIALOG`, async () => {
      const n = await ensureNimiq()
      if (!nimAddress) throw new Error('Run listAccounts first to get your NIM address.')
      const hash = await n.sendBasicTransaction({
        recipient: nimAddress,
        value: nimToLuna(Number(nimAmount)),
      })
      return `tx ${hash}`
    })

  const connectEvm = () =>
    run('eth_requestAccounts (EVM) — native dialog', async () => {
      const accounts = await requestEvmAccounts()
      setEvmAddress(accounts[0] ?? null)
      const cid = await getChainId()
      setChainId(cid)
      return `${accounts[0] ?? '(none)'} @ chain ${cid}`
    })

  const switchPolygon = () =>
    run('switch to Polygon (0x89)', async () => {
      await switchToPolygon()
      const cid = await getChainId()
      setChainId(cid)
      return `chain ${cid}`
    })

  const readBalances = () =>
    run('read POL + USDT balance', async () => {
      if (!evmAddress) throw new Error('Connect EVM first.')
      const [pol, usdt] = await Promise.all([getNativeBalance(evmAddress), getUsdtBalance(evmAddress)])
      setPolBalance(pol)
      setUsdtBalance(usdt)
      return `POL=${pol} (gas), USDT=${usdt}`
    })

  const sendUsdtToSelf = () =>
    run(`★ send ${usdtAmount} USDT to self — NATIVE EVM DIALOG`, async () => {
      if (!evmAddress) throw new Error('Connect EVM first.')
      const hash = await sendUsdt(evmAddress, evmAddress, usdtAmount)
      return `tx ${hash}`
    })

  return (
    <main className="recon">
      <header className="hd">
        <h1>Stakes · dual-chain recon</h1>
        <p className="sub">Probe the two providers and the native confirm dialogs. Open inside Nimiq Pay.</p>
      </header>

      <section className="card">
        <h2>Status</h2>
        <dl className="kv">
          <div>
            <dt>NIM address</dt>
            <dd className="mono">{nimAddress ?? '—'}</dd>
          </div>
          <div>
            <dt>NIM consensus</dt>
            <dd>{nimReady === null ? '—' : String(nimReady)}</dd>
          </div>
          <div>
            <dt>EVM address</dt>
            <dd className="mono">{evmAddress ?? '—'}</dd>
          </div>
          <div>
            <dt>EVM chain</dt>
            <dd className="mono">{chainId ?? '—'}</dd>
          </div>
          <div>
            <dt>POL (gas)</dt>
            <dd className={polBalance === '0' ? 'warn mono' : 'mono'}>{polBalance ?? '—'}</dd>
          </div>
          <div>
            <dt>USDT</dt>
            <dd className="mono">{usdtBalance ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>Nimiq (NIM) — the custodial happy-path</h2>
        <div className="btns">
          <button onClick={initNimiq}>Init + consensus</button>
          <button onClick={listNim}>listAccounts</button>
          <button onClick={signNim}>sign message</button>
        </div>
        <div className="rrow">
          <input value={nimAmount} onChange={(e) => setNimAmount(e.target.value)} inputMode="decimal" aria-label="NIM amount" />
          <button className="star" onClick={sendNimToSelf}>
            ★ Send NIM to self
          </button>
        </div>
      </section>

      <section className="card">
        <h2>EVM (USDT on Polygon) — the gas-friction path</h2>
        <div className="btns">
          <button onClick={connectEvm}>Connect EVM</button>
          <button onClick={switchPolygon}>Switch to Polygon</button>
          <button onClick={readBalances}>Read POL + USDT</button>
        </div>
        <div className="rrow">
          <input value={usdtAmount} onChange={(e) => setUsdtAmount(e.target.value)} inputMode="decimal" aria-label="USDT amount" />
          <button className="star" onClick={sendUsdtToSelf}>
            ★ Send USDT to self
          </button>
        </div>
        <p className="hint">
          If POL is 0, this should fail at broadcast — but the native dialog still appears first.
          That's the evidence we want.
        </p>
      </section>

      <section className="card">
        <h2>Log</h2>
        <ul className="log">
          {log.map((e, i) => (
            <li key={i} className={e.kind}>
              <span className="ts">{e.t}</span> {e.msg}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
