import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { scanMarkets, ScanResult, Strategy, ScanProgress } from './ai-scanner-service';
import './ai-scanner.scss';

// ─── strategy config ──────────────────────────────────────────────────────────

type StrategyConfig = {
    id: Strategy;
    label: string;
    title: string;
    description: string;
};

const STRATEGIES: StrategyConfig[] = [
    {
        id: 'over1under8',
        label: 'Over1 / Under8',
        title: 'Over 1 / Under 8',
        description: 'Initial trade Over 1; on loss, recovery flips to Under 8.',
    },
    {
        id: 'over2under7',
        label: 'Over2 / Under7',
        title: 'Over 2 / Under 7',
        description: 'Initial trade Over 2; on loss, recovery flips to Under 7.',
    },
    {
        id: 'over3under6',
        label: 'Over3 / Under6',
        title: 'Over 3 / Under 6',
        description: 'Initial trade Over 3; on loss, recovery flips to Under 6.',
    },
    {
        id: 'evenodd',
        label: 'Even / Odd',
        title: 'Even / Odd',
        description: 'Initial trade Even; on loss, recovery flips to Odd.',
    },
];

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

// ─── component ────────────────────────────────────────────────────────────────

const AiScanner = () => {
    const store = useStore();

    // ── drag state ───────────────────────────────────────────────────────────
    // Position is stored as { right, bottom } so it stays anchored to the
    // right-bottom corner regardless of window size.
    const [pos, setPos] = useState({ right: 24, bottom: 120 });
    const isDragging = useRef(false);
    const hasDragged = useRef(false);
    const dragStart = useRef({ x: 0, y: 0, right: 0, bottom: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        // Only drag on primary button / touch
        if (e.button !== 0 && e.pointerType !== 'touch') return;
        isDragging.current = true;
        hasDragged.current = false;
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            right: pos.right,
            bottom: pos.bottom,
        };
        btnRef.current?.setPointerCapture(e.pointerId);
    }, [pos]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
        setPos({
            right: Math.max(8, dragStart.current.right - dx),
            bottom: Math.max(8, dragStart.current.bottom - dy),
        });
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        isDragging.current = false;
        btnRef.current?.releasePointerCapture(e.pointerId);
    }, []);

    // ── scanner state ─────────────────────────────────────────────────────────
    const [isOpen, setIsOpen] = useState(false);
    const [activeStrategyIdx, setActiveStrategyIdx] = useState(0);
    const [ticks, setTicks] = useState(3000);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [progress, setProgress] = useState<ScanProgress | null>(null);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState('');

    const abortRef = useRef<AbortController | null>(null);
    const strategy = STRATEGIES[activeStrategyIdx];

    useEffect(() => {
        if (scanState === 'scanning') abortRef.current?.abort();
        setScanState('idle');
        setResults([]);
        setSelectedSymbol(null);
        setProgress(null);
        setStatusMsg('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStrategyIdx]);

    // ── derived display ───────────────────────────────────────────────────────
    const bestResult = results[0] ?? null;

    const displaySymbol =
        selectedSymbol
            ? (results.find(r => r.symbol === selectedSymbol)?.name ?? selectedSymbol)
            : scanState === 'idle'
              ? 'Scan to find the best market'
              : scanState === 'scanning'
                ? `Scanning ${progress?.symbol ?? '…'}`
                : (bestResult?.name ?? '—');

    const displayTradeType =
        selectedSymbol
            ? (results.find(r => r.symbol === selectedSymbol)?.tradeType ?? '—')
            : scanState === 'idle'
              ? 'Waiting for scan'
              : scanState === 'scanning'
                ? 'Analysing ticks…'
                : (bestResult?.tradeType ?? '—');

    const progressPct =
        progress && progress.total > 0 ? Math.round(((progress.index + 1) / progress.total) * 100) : 0;

    function statusFor(state: ScanState, prog: ScanProgress | null, res: ScanResult[]): string {
        switch (state) {
            case 'idle':     return `Ready to scan ${strategy.title}`;
            case 'scanning': return prog ? `Scanning ${prog.symbol} (${prog.index + 1}/${prog.total})…` : 'Starting…';
            case 'done':     return res.length === 0 ? 'No results — check connection.' : `Best: ${res[0].name} — ${res[0].tradeType} (${res[0].percentage})`;
            case 'error':    return 'Scan failed. Check connection and retry.';
        }
    }

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleToggle = () => {
        if (hasDragged.current) return; // suppress click after drag
        setIsOpen(o => !o);
    };

    const handleScan = async () => {
        if (scanState === 'scanning') {
            abortRef.current?.abort();
            setScanState('idle');
            setStatusMsg(statusFor('idle', null, []));
            return;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setScanState('scanning');
        setResults([]);
        setSelectedSymbol(null);
        setProgress(null);
        setStatusMsg('Starting scan…');
        try {
            const res = await scanMarkets(strategy.id, ticks, p => {
                setProgress(p);
                setStatusMsg(statusFor('scanning', p, []));
            }, ctrl.signal);
            if (ctrl.signal.aborted) return;
            setResults(res);
            setScanState('done');
            setStatusMsg(statusFor('done', null, res));
        } catch {
            if (ctrl.signal.aborted) return;
            setScanState('error');
            setStatusMsg(statusFor('error', null, []));
        }
    };

    const handleLoadBot = () => {
        if (!bestResult && !selectedSymbol) return;
        if (store?.dashboard) store.dashboard.setActiveTabIndex(DBOT_TABS.BOT_BUILDER);
        setIsOpen(false);
    };

    const handleClose = () => {
        abortRef.current?.abort();
        setIsOpen(false);
    };

    // ── modal anchor: flip side if too close to an edge ───────────────────────
    // Modal opens to the left of the button by default; if button is on left side,
    // opens to the right.
    const modalStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: pos.bottom + 64, // just above the button
        right: pos.right,
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Draggable trigger button ──────────────────────────────── */}
            <button
                ref={btnRef}
                className={`ai-scanner-trigger${isOpen ? ' ai-scanner-trigger--active' : ''}`}
                style={{ position: 'fixed', right: pos.right, bottom: pos.bottom }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={handleToggle}
                aria-label='AI Entry Scanner'
                title='AI Entry Scanner'
                touch-action='none'
            >
                <span>AI</span>
                <div className='ai-scanner-trigger__dot' />
            </button>

            {/* ── Backdrop ──────────────────────────────────────────────── */}
            {isOpen && <div className='ai-scanner-backdrop' onClick={handleClose} />}

            {/* ── Modal popup ───────────────────────────────────────────── */}
            {isOpen && (
                <div className='ai-scanner-modal' style={modalStyle} role='dialog' aria-label='Entry Scanner'>
                    {/* Header */}
                    <div className='ai-scanner-modal__header'>
                        <h3>Entry Scanner</h3>
                        <button className='ai-scanner-modal__close' onClick={handleClose} aria-label='Close'>
                            ✕
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className='ai-scanner-modal__tabs'>
                        {STRATEGIES.map((s, idx) => (
                            <button
                                key={s.id}
                                className={`ai-scanner-modal__tab${idx === activeStrategyIdx ? ' ai-scanner-modal__tab--active' : ''}`}
                                onClick={() => setActiveStrategyIdx(idx)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Body */}
                    <div className='ai-scanner-modal__body'>
                        <div className='ai-scanner-modal__strategy-header'>
                            <div className='ai-scanner-modal__strategy-info'>
                                <h4>{strategy.title}</h4>
                                <p>{strategy.description}</p>
                            </div>
                            <div className='ai-scanner-modal__ticks'>
                                <label>TICKS</label>
                                <input
                                    type='number'
                                    min={100}
                                    max={5000}
                                    step={100}
                                    value={ticks}
                                    onChange={e => setTicks(Math.max(100, Math.min(5000, parseInt(e.target.value) || 100)))}
                                    disabled={scanState === 'scanning'}
                                />
                            </div>
                        </div>

                        <div className='ai-scanner-modal__fields'>
                            <div className='ai-scanner-modal__field'>
                                <label>SELECTED MARKET</label>
                                <span title={displaySymbol}>{displaySymbol}</span>
                            </div>
                            <div className='ai-scanner-modal__field'>
                                <label>TRADE TYPE</label>
                                <span>{displayTradeType}</span>
                            </div>
                        </div>

                        {scanState === 'scanning' && (
                            <div className='ai-scanner-modal__progress'>
                                <div className='ai-scanner-modal__progress-bar' style={{ width: `${progressPct}%` }} />
                            </div>
                        )}

                        <div className={`ai-scanner-modal__status${scanState !== 'idle' ? ` ai-scanner-modal__status--${scanState}` : ''}`}>
                            {scanState === 'scanning' && <div className='ai-scanner-spinner' />}
                            {statusMsg || statusFor(scanState, progress, results)}
                        </div>

                        {results.length > 0 && (
                            <div className='ai-scanner-modal__results'>
                                {results.map((r, idx) => (
                                    <div
                                        key={r.symbol}
                                        className={[
                                            'ai-scanner-modal__result-row',
                                            idx === 0 ? 'ai-scanner-modal__result-row--best' : '',
                                            selectedSymbol === r.symbol ? 'ai-scanner-modal__result-row--selected' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => setSelectedSymbol(prev => prev === r.symbol ? null : r.symbol)}
                                    >
                                        <span className='ai-scanner-modal__result-rank'>#{idx + 1}</span>
                                        <span className='ai-scanner-modal__result-name'>{r.name}</span>
                                        <span className='ai-scanner-modal__result-type'>{r.tradeType}</span>
                                        <span className='ai-scanner-modal__result-pct'>{r.percentage}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className='ai-scanner-modal__actions'>
                            <button className='ai-scanner-modal__btn ai-scanner-modal__btn--primary' onClick={handleScan}>
                                {scanState === 'scanning' ? 'Stop Scan' : 'Scan Markets'}
                            </button>
                            <button
                                className='ai-scanner-modal__btn ai-scanner-modal__btn--secondary'
                                onClick={handleLoadBot}
                                disabled={scanState !== 'done' || results.length === 0}
                            >
                                Load Scanner Bot
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AiScanner;
