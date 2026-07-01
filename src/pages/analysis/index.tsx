import React, { useState } from 'react';
import { Localize } from '@deriv-com/translations';
import './analysis.scss';

// --- Types ---
type TradeResult = 'win' | 'loss';

interface TradeEntry {
    id: number;
    result: TradeResult;
    stake: number;
    payout: number;
    timestamp: string;
}

// --- Digit Frequency Analyzer ---
const DigitFrequency = () => {
    const [digits, setDigits] = useState<number[]>([]);
    const [input, setInput] = useState('');

    const handleAdd = () => {
        const parsed = input
            .split(/[\s,]+/)
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n >= 0 && n <= 9);
        if (parsed.length > 0) {
            setDigits(prev => [...prev, ...parsed]);
            setInput('');
        }
    };

    const handleClear = () => {
        setDigits([]);
        setInput('');
    };

    const counts: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) counts[i] = 0;
    digits.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
    const max = Math.max(...Object.values(counts), 1);

    return (
        <div className='analysis__tool'>
            <h3 className='analysis__tool-title'>
                <Localize i18n_default_text='Digit Frequency Analyzer' />
            </h3>
            <p className='analysis__tool-desc'>
                <Localize i18n_default_text='Enter last-digit values (0–9) to see which digits appear most often.' />
            </p>
            <div className='analysis__input-row'>
                <input
                    className='analysis__input'
                    type='text'
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder='e.g. 3, 7, 2, 5, 8'
                />
                <button className='analysis__btn' onClick={handleAdd}>
                    <Localize i18n_default_text='Add' />
                </button>
                <button className='analysis__btn analysis__btn--secondary' onClick={handleClear}>
                    <Localize i18n_default_text='Clear' />
                </button>
            </div>
            <p className='analysis__count-label'>
                <Localize i18n_default_text='Total samples: ' />{digits.length}
            </p>
            <div className='analysis__bar-chart'>
                {Array.from({ length: 10 }, (_, i) => {
                    const count = counts[i];
                    const pct = digits.length > 0 ? ((count / digits.length) * 100).toFixed(1) : '0.0';
                    const barH = max > 0 ? (count / max) * 100 : 0;
                    return (
                        <div key={i} className='analysis__bar-col'>
                            <span className='analysis__bar-pct'>{pct}%</span>
                            <div className='analysis__bar-wrap'>
                                <div
                                    className='analysis__bar'
                                    style={{ height: `${barH}%` }}
                                />
                            </div>
                            <span className='analysis__bar-label'>{i}</span>
                            <span className='analysis__bar-count'>{count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Win/Loss Tracker ---
const WinLossTracker = () => {
    const [trades, setTrades] = useState<TradeEntry[]>([]);
    const [stake, setStake] = useState('');
    const [payout, setPayout] = useState('');
    const nextId = React.useRef(1);

    const addTrade = (result: TradeResult) => {
        const s = parseFloat(stake) || 0;
        const p = parseFloat(payout) || 0;
        const now = new Date().toLocaleTimeString();
        setTrades(prev => [
            { id: nextId.current++, result, stake: s, payout: p, timestamp: now },
            ...prev,
        ]);
    };

    const clearAll = () => { setTrades([]); nextId.current = 1; };

    const wins = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');
    const totalPayout = wins.reduce((acc, t) => acc + t.payout, 0);
    const totalStake = trades.reduce((acc, t) => acc + t.stake, 0);
    const netPnL = totalPayout - totalStake;
    const winRate = trades.length > 0 ? ((wins.length / trades.length) * 100).toFixed(1) : '0.0';

    return (
        <div className='analysis__tool'>
            <h3 className='analysis__tool-title'>
                <Localize i18n_default_text='Win / Loss Tracker' />
            </h3>
            <p className='analysis__tool-desc'>
                <Localize i18n_default_text='Record each trade result to track your win rate and net profit/loss.' />
            </p>
            <div className='analysis__input-row'>
                <input
                    className='analysis__input analysis__input--sm'
                    type='number'
                    min='0'
                    step='0.01'
                    value={stake}
                    onChange={e => setStake(e.target.value)}
                    placeholder='Stake'
                />
                <input
                    className='analysis__input analysis__input--sm'
                    type='number'
                    min='0'
                    step='0.01'
                    value={payout}
                    onChange={e => setPayout(e.target.value)}
                    placeholder='Payout (on win)'
                />
                <button className='analysis__btn analysis__btn--win' onClick={() => addTrade('win')}>
                    + Win
                </button>
                <button className='analysis__btn analysis__btn--loss' onClick={() => addTrade('loss')}>
                    + Loss
                </button>
                <button className='analysis__btn analysis__btn--secondary' onClick={clearAll}>
                    <Localize i18n_default_text='Clear' />
                </button>
            </div>

            <div className='analysis__stats-row'>
                <div className='analysis__stat'>
                    <span className='analysis__stat-value'>{trades.length}</span>
                    <span className='analysis__stat-label'><Localize i18n_default_text='Total Trades' /></span>
                </div>
                <div className='analysis__stat'>
                    <span className='analysis__stat-value analysis__stat-value--win'>{wins.length}</span>
                    <span className='analysis__stat-label'><Localize i18n_default_text='Wins' /></span>
                </div>
                <div className='analysis__stat'>
                    <span className='analysis__stat-value analysis__stat-value--loss'>{losses.length}</span>
                    <span className='analysis__stat-label'><Localize i18n_default_text='Losses' /></span>
                </div>
                <div className='analysis__stat'>
                    <span className='analysis__stat-value'>{winRate}%</span>
                    <span className='analysis__stat-label'><Localize i18n_default_text='Win Rate' /></span>
                </div>
                <div className='analysis__stat'>
                    <span className={`analysis__stat-value ${netPnL >= 0 ? 'analysis__stat-value--win' : 'analysis__stat-value--loss'}`}>
                        {netPnL >= 0 ? '+' : ''}{netPnL.toFixed(2)}
                    </span>
                    <span className='analysis__stat-label'><Localize i18n_default_text='Net P&L' /></span>
                </div>
            </div>

            {trades.length > 0 && (
                <div className='analysis__history'>
                    <h4 className='analysis__history-title'><Localize i18n_default_text='Recent Trades' /></h4>
                    <div className='analysis__history-list'>
                        {trades.slice(0, 20).map(t => (
                            <div key={t.id} className={`analysis__history-row analysis__history-row--${t.result}`}>
                                <span className='analysis__history-badge'>{t.result.toUpperCase()}</span>
                                <span>Stake: {t.stake.toFixed(2)}</span>
                                {t.result === 'win' && <span>Payout: {t.payout.toFixed(2)}</span>}
                                <span className='analysis__history-time'>{t.timestamp}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Stake Calculator ---
const StakeCalculator = () => {
    const [balance, setBalance] = useState('');
    const [riskPct, setRiskPct] = useState('2');
    const [multiplier, setMultiplier] = useState('2');
    const [steps, setSteps] = useState('5');

    const bal = parseFloat(balance) || 0;
    const risk = parseFloat(riskPct) || 0;
    const mult = parseFloat(multiplier) || 2;
    const numSteps = Math.min(Math.max(parseInt(steps, 10) || 5, 1), 15);
    const baseStake = bal * (risk / 100);

    const martingaleSteps = Array.from({ length: numSteps }, (_, i) => ({
        step: i + 1,
        stake: baseStake * Math.pow(mult, i),
    }));

    return (
        <div className='analysis__tool'>
            <h3 className='analysis__tool-title'>
                <Localize i18n_default_text='Stake Calculator' />
            </h3>
            <p className='analysis__tool-desc'>
                <Localize i18n_default_text='Calculate optimal stake sizes based on your balance and risk tolerance.' />
            </p>
            <div className='analysis__calc-grid'>
                <label className='analysis__label'>
                    <Localize i18n_default_text='Account Balance' />
                    <input
                        className='analysis__input'
                        type='number'
                        min='0'
                        step='0.01'
                        value={balance}
                        onChange={e => setBalance(e.target.value)}
                        placeholder='e.g. 1000'
                    />
                </label>
                <label className='analysis__label'>
                    <Localize i18n_default_text='Risk per trade (%)' />
                    <input
                        className='analysis__input'
                        type='number'
                        min='0.1'
                        max='100'
                        step='0.1'
                        value={riskPct}
                        onChange={e => setRiskPct(e.target.value)}
                    />
                </label>
                <label className='analysis__label'>
                    <Localize i18n_default_text='Martingale multiplier' />
                    <input
                        className='analysis__input'
                        type='number'
                        min='1'
                        step='0.1'
                        value={multiplier}
                        onChange={e => setMultiplier(e.target.value)}
                    />
                </label>
                <label className='analysis__label'>
                    <Localize i18n_default_text='Steps to show' />
                    <input
                        className='analysis__input'
                        type='number'
                        min='1'
                        max='15'
                        step='1'
                        value={steps}
                        onChange={e => setSteps(e.target.value)}
                    />
                </label>
            </div>

            {bal > 0 && (
                <div className='analysis__calc-results'>
                    <p className='analysis__calc-base'>
                        <strong><Localize i18n_default_text='Base stake: ' /></strong>
                        {baseStake.toFixed(2)} ({risk}% of {bal.toFixed(2)})
                    </p>
                    <div className='analysis__steps'>
                        {martingaleSteps.map(({ step, stake }) => (
                            <div key={step} className='analysis__step-row'>
                                <span className='analysis__step-num'>Step {step}</span>
                                <div className='analysis__step-bar-wrap'>
                                    <div
                                        className='analysis__step-bar'
                                        style={{ width: `${Math.min((stake / (baseStake * Math.pow(mult, numSteps - 1))) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className='analysis__step-val'>{stake.toFixed(2)}</span>
                                {stake > bal * 0.5 && (
                                    <span className='analysis__step-warn'>⚠ &gt;50% balance</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Analysis Page ---
type ToolTab = 'digit' | 'tracker' | 'calc';

const AnalysisTools = () => {
    const [activeTab, setActiveTab] = useState<ToolTab>('digit');

    const toolTabs: { id: ToolTab; label: string }[] = [
        { id: 'digit', label: 'Digit Frequency' },
        { id: 'tracker', label: 'Win/Loss Tracker' },
        { id: 'calc', label: 'Stake Calculator' },
    ];

    return (
        <div className='analysis'>
            <div className='analysis__header'>
                <h2 className='analysis__title'>
                    <Localize i18n_default_text='Analysis Tools' />
                </h2>
                <p className='analysis__subtitle'>
                    <Localize i18n_default_text='Study market patterns, track your performance, and plan your staking strategy.' />
                </p>
            </div>
            <div className='analysis__tool-tabs'>
                {toolTabs.map(t => (
                    <button
                        key={t.id}
                        className={`analysis__tool-tab${activeTab === t.id ? ' analysis__tool-tab--active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className='analysis__content'>
                {activeTab === 'digit' && <DigitFrequency />}
                {activeTab === 'tracker' && <WinLossTracker />}
                {activeTab === 'calc' && <StakeCalculator />}
            </div>
        </div>
    );
};

export default AnalysisTools;
