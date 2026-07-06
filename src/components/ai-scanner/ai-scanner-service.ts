/**
 * AI Scanner Service
 *
 * Connects to the Deriv WebSocket API, fetches tick history for each
 * synthetic-digits market, and scores them for the selected strategy.
 */
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';

const APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || '36544';
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

// ─── constants ────────────────────────────────────────────────────────────────

export const SCAN_SYMBOLS = [
    { symbol: 'R_10', name: 'Volatility 10' },
    { symbol: 'R_25', name: 'Volatility 25' },
    { symbol: 'R_50', name: 'Volatility 50' },
    { symbol: 'R_75', name: 'Volatility 75' },
    { symbol: 'R_100', name: 'Volatility 100' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s)' },
    { symbol: '1HZ25V', name: 'Volatility 25 (1s)' },
    { symbol: '1HZ50V', name: 'Volatility 50 (1s)' },
    { symbol: '1HZ75V', name: 'Volatility 75 (1s)' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s)' },
];

// ─── types ────────────────────────────────────────────────────────────────────

export type Strategy = 'over1under8' | 'over2under7' | 'over3under6' | 'evenodd';

export type ScanResult = {
    symbol: string;
    name: string;
    score: number;
    tradeType: string;
    percentage: string;
    digitCounts: number[];
};

export type ScanProgress = {
    symbol: string;
    index: number;
    total: number;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getLastDigit(price: number | string): number {
    const str = price.toString();
    return parseInt(str[str.length - 1], 10);
}

function buildDigitCounts(digits: number[]): number[] {
    const counts = new Array(10).fill(0);
    digits.forEach(d => counts[d]++);
    return counts;
}

function scoreMarket(
    digits: number[],
    strategy: Strategy
): { score: number; tradeType: string; percentage: string } {
    const total = digits.length;
    if (total === 0) return { score: 0, tradeType: '', percentage: '0%' };

    switch (strategy) {
        case 'over1under8': {
            const count = digits.filter(d => d > 1).length;
            const score = count / total;
            return {
                score,
                tradeType: score >= 0.5 ? 'Over 1' : 'Under 8',
                percentage: `${(score * 100).toFixed(1)}%`,
            };
        }
        case 'over2under7': {
            const count = digits.filter(d => d > 2).length;
            const score = count / total;
            return {
                score,
                tradeType: score >= 0.5 ? 'Over 2' : 'Under 7',
                percentage: `${(score * 100).toFixed(1)}%`,
            };
        }
        case 'over3under6': {
            const count = digits.filter(d => d > 3).length;
            const score = count / total;
            return {
                score,
                tradeType: score >= 0.5 ? 'Over 3' : 'Under 6',
                percentage: `${(score * 100).toFixed(1)}%`,
            };
        }
        case 'evenodd': {
            const evenCount = digits.filter(d => d % 2 === 0).length;
            const evenPct = evenCount / total;
            const oddPct = 1 - evenPct;
            const score = Math.max(evenPct, oddPct);
            // Bet against the recent trend (contrarian — matches Deriv's mean-reversion pattern)
            const tradeType = evenPct > oddPct ? 'Odd' : 'Even';
            return {
                score,
                tradeType,
                percentage: `${(score * 100).toFixed(1)}%`,
            };
        }
        default:
            return { score: 0, tradeType: '', percentage: '0%' };
    }
}

// ─── main scan ────────────────────────────────────────────────────────────────

/**
 * Scans all synthetic-digit markets and returns them ranked by score for the
 * given strategy.  Calls `onProgress` after each symbol is fetched so the UI
 * can show a live progress indicator.
 */
export async function scanMarkets(
    strategy: Strategy,
    tickCount: number,
    onProgress: (p: ScanProgress) => void,
    signal?: AbortSignal
): Promise<ScanResult[]> {
    const api = new DerivAPIBasic({ endpoint: WS_URL });
    const results: ScanResult[] = [];

    try {
        for (let i = 0; i < SCAN_SYMBOLS.length; i++) {
            if (signal?.aborted) break;

            const { symbol, name } = SCAN_SYMBOLS[i];
            onProgress({ symbol, index: i, total: SCAN_SYMBOLS.length });

            try {
                const response = await (api as any).send({
                    ticks_history: symbol,
                    count: Math.min(tickCount, 5000),
                    end: 'latest',
                    style: 'ticks',
                });

                const prices: number[] = response?.history?.prices ?? [];
                const digits = prices.map(p => getLastDigit(p));
                const { score, tradeType, percentage } = scoreMarket(digits, strategy);
                const digitCounts = buildDigitCounts(digits);

                results.push({ symbol, name, score, tradeType, percentage, digitCounts });
            } catch {
                // Symbol unavailable or request failed — skip silently
            }
        }
    } finally {
        try {
            (api as any).disconnect();
        } catch {
            // ignore disconnect errors
        }
    }

    return results.sort((a, b) => b.score - a.score);
}
