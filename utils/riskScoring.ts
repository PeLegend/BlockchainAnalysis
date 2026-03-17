




// --- Constants ---
export const RISK_RULES = {
    BLACKLIST: 100,    // 100 → 70
    SMURFING: 70,     // 40 → 25
    HIGH_FREQ: 20     // 20 → 10
};

// Thresholds
const FAN_THRESHOLD = 4;        // ≥ 5 unique (User requested > 4)
const BURST_THRESHOLD = 4;      // เพิ่มจาก 5 → 7 (ต้องมี ≥ 7 tx ใน 1 นาที)
const BURST_WINDOW_MS = 60_000;

// Default hardcoded blacklist (fallback)
export const DEFAULT_BLACKLIST_ADDRESSES = new Set(
    [
        'Test',
    ].map(a => a.toLowerCase())
);

// Default DApps/Exchanges to exempt from risk scoring to prevent score inflation
export const EXEMPT_ADDRESSES = new Set<string>([
    // '0xSomeKnownExchangeAddress',
]);

// Legacy export for backward compatibility
export const BLACKLIST_ADDRESSES = DEFAULT_BLACKLIST_ADDRESSES;

// --- Interfaces ---
export interface RiskAnalysisNode {
    id: string;
    group: string;
    timestamp?: number;
    metadata?: { blockTimestamp?: string | number };
    [key: string]: any;
}

export interface RiskAnalysisLink {
    source: string | any;
    target: string | any;
    timestamp?: number;
    metadata?: { blockTimestamp?: string | number };
    [key: string]: any;
}

export interface RiskResult {
    score: number;
    reasons: Set<string>;
    reasonsMap: Map<string, number>;
}

export function calculateRiskScores(
    nodes: RiskAnalysisNode[],
    links: RiskAnalysisLink[],
    blacklistAddresses?: Set<string> | string[],
    exemptAddressesList?: string[]
): Map<string, RiskResult> {

    // --- Configuration ---
    const TRANSMISSION_RATE = 0.1;
    const MAX_ROUNDS = 3;

    // Prepare blacklist set
    let activeBlacklist: Set<string>;
    if (blacklistAddresses) {
        if (blacklistAddresses instanceof Set) {
            activeBlacklist = new Set([...blacklistAddresses].map(a => a.toLowerCase()));
        } else {
            activeBlacklist = new Set(blacklistAddresses.map(a => a.toLowerCase()));
        }
    } else {
        activeBlacklist = DEFAULT_BLACKLIST_ADDRESSES;
    }

    const exemptNodes = new Set<string>([...EXEMPT_ADDRESSES]);
    if (exemptAddressesList) {
        exemptAddressesList.forEach(a => exemptNodes.add(a.toLowerCase()));
    }

    // --- Node Maps & Graph Building ---
    const nodeMap = new Map(nodes.map(n => [String(n.id).toLowerCase(), n]));
    const txNodes = new Set(nodes.filter(n => n.group === 'Transaction').map(n => String(n.id).toLowerCase()));
    const txSenders = new Map<string, string>();
    const txReceivers = new Map<string, string>();
    const transfers: { from: string; to: string; time: number }[] = [];

    links.forEach(l => {
        const s = String(typeof l.source === 'object' ? l.source.id : l.source).toLowerCase();
        const t = String(typeof l.target === 'object' ? l.target.id : l.target).toLowerCase();
        if (txNodes.has(s)) txReceivers.set(s, t);
        else if (txNodes.has(t)) txSenders.set(t, s);
        else transfers.push({ from: s, to: t, time: l.timestamp || 0 });
    });

    txNodes.forEach(txId => {
        const s = txSenders.get(txId);
        const r = txReceivers.get(txId);
        if (s && r) {
            const node = nodeMap.get(txId);
            const time = node?.timestamp || 0;
            transfers.push({ from: s, to: r, time });
        }
    });

    // Build Adjacency List for Wallets (Neighbors N(n))
    const adj = new Map<string, Set<string>>();
    transfers.forEach(tx => {
        if (exemptNodes.has(tx.from) || exemptNodes.has(tx.to)) return;
        if (!adj.has(tx.from)) adj.set(tx.from, new Set());
        if (!adj.has(tx.to)) adj.set(tx.to, new Set());
        adj.get(tx.from)!.add(tx.to);
        adj.get(tx.to)!.add(tx.from);
    });

    const riskMap = new Map<string, RiskResult>();
    const getRisk = (id: string) => {
        if (!riskMap.has(id)) {
            riskMap.set(id, { score: 0, reasons: new Set(), reasonsMap: new Map() });
        }
        return riskMap.get(id)!;
    };

    // --- Step 1: Calculate Base Risk (S_base) ---
    // S_base = S_blacklist + S_behavior
    const baseScores = new Map<string, number>();

    // A. Blacklist
    activeBlacklist.forEach(id => {
        baseScores.set(id, 100);
        getRisk(id).reasonsMap.set('Blacklisted Wallet Address', 100);
    });

    // A2. Interaction with Blacklist (Immediate 100 Risk)
    transfers.forEach(tx => {
        const fromAddr = tx.from.toLowerCase();
        const toAddr = tx.to.toLowerCase();

        // If I transfer TO a blacklist
        if (activeBlacklist.has(toAddr)) {
            baseScores.set(fromAddr, 100);
            getRisk(fromAddr).reasonsMap.set('Transfer to Blacklist', 100);
        }

        // If I receive FROM a blacklist
        if (activeBlacklist.has(fromAddr)) {
            baseScores.set(toAddr, 100);
            getRisk(toAddr).reasonsMap.set('Received from Blacklist', 100);
        }
    });

    // B. Behavior (Smurfing/Burst)
    const stats = new Map<string, { 
        out: Set<string>; 
        in: Set<string>; 
        totalOut: number; 
        totalIn: number; 
        times: number[] 
    }>();
    
    transfers.forEach(tx => {
        if (exemptNodes.has(tx.from) || exemptNodes.has(tx.to)) return;
        if (!stats.has(tx.from)) stats.set(tx.from, { out: new Set(), in: new Set(), totalOut: 0, totalIn: 0, times: [] });
        if (!stats.has(tx.to)) stats.set(tx.to, { out: new Set(), in: new Set(), totalOut: 0, totalIn: 0, times: [] });
        
        stats.get(tx.from)!.out.add(tx.to);
        stats.get(tx.from)!.totalOut++;
        stats.get(tx.from)!.times.push(tx.time);
        
        stats.get(tx.to)!.in.add(tx.from);
        stats.get(tx.to)!.totalIn++;
        stats.get(tx.to)!.times.push(tx.time);
    });

    stats.forEach((s, id) => {
        let behaviorScore = 0;
        
        // --- Dynamic Fan-out Scoring ---
        if (s.out.size > 5) {
            const ratio = s.out.size / s.totalOut;
            const dynamicScore = (ratio * 50) + (Math.log10(s.out.size + 1) * 10);
            behaviorScore += dynamicScore;
            getRisk(id).reasonsMap.set(`High Fan-out (Ratio: ${ratio.toFixed(2)})`, dynamicScore);
        }
        
        // --- Dynamic Fan-in Scoring ---
        if (s.in.size > 5) {
            const ratio = s.in.size / s.totalIn;
            const dynamicScore = (ratio * 50) + (Math.log10(s.in.size + 1) * 10);
            behaviorScore += dynamicScore;
            getRisk(id).reasonsMap.set(`High Fan-in (Ratio: ${ratio.toFixed(2)})`, dynamicScore);
        }

        // --- Burst Scoring ---
        if (s.times.length >= BURST_THRESHOLD) {
            s.times.sort((a, b) => a - b);
            for (let i = 0; i <= s.times.length - BURST_THRESHOLD; i++) {
                if (s.times[i + BURST_THRESHOLD - 1] - s.times[i] <= BURST_WINDOW_MS) {
                    behaviorScore += RISK_RULES.HIGH_FREQ;
                    getRisk(id).reasonsMap.set(`High Frequency Burst Activity`, RISK_RULES.HIGH_FREQ);
                    break;
                }
            }
        }

        // --- Behavior Cap ---
        // Behavioral contribution (Rule 2 + 3) never exceeds 60 pts
        if (behaviorScore > 0) {
            const cappedBehavior = Math.min(behaviorScore, 60);
            const currentBase = baseScores.get(id) || 0;
            baseScores.set(id, currentBase + cappedBehavior);
        }
    });

    // --- Step 2: Iterative Propagation (3 Rounds) ---
    // S^(x)(n) = max( S_base(n), S^(x-1)(n) + sum( S^(x-1)(neighbors) * 0.1 * 1/x ) )
    let currentScores = new Map(baseScores);

    for (let x = 1; x <= MAX_ROUNDS; x++) {
        const nextScores = new Map<string, number>();
        const decay = 1 / x;

        nodeMap.forEach((_, id) => {
            if (exemptNodes.has(id)) return;

            const sBase = baseScores.get(id) || 0;
            const prevScore = currentScores.get(id) || 0;

            let neighborSum = 0;
            const neighbors = adj.get(id) || new Set();
            neighbors.forEach(nId => {
                neighborSum += currentScores.get(nId) || 0;
            });

            const propagatedRisk = neighborSum * TRANSMISSION_RATE * decay;
            const newScore = Math.max(sBase, prevScore + propagatedRisk);

            // Display Fix: Show final score for the round instead of increment
            if (propagatedRisk > 0.5) {
                getRisk(id).reasonsMap.set(`Risk after Round ${x} Propagation`, newScore);
            }

            nextScores.set(id, newScore);
        });

        currentScores = nextScores;
    }

    // --- Step 3: Finalization & Exemption ---
    // Track direct blacklist contacts for "Critical Reservation"
    const directContacts = new Set<string>();
    transfers.forEach(tx => {
        if (activeBlacklist.has(tx.from) || activeBlacklist.has(tx.to)) {
            directContacts.add(tx.from);
            directContacts.add(tx.to);
        }
    });

    riskMap.forEach((r, id) => {
        if (exemptNodes.has(id)) {
            r.score = 0;
            r.reasons.clear();
            r.reasonsMap.clear();
            r.reasons.add('Exempt DApp/Exchange (Risk Ignored)');
            return;
        }

        let finalScore = currentScores.get(id) || 0;
        const node = nodeMap.get(id);

        if (node?.group === 'Transaction') {
            const s = txSenders.get(id);
            const rec = txReceivers.get(id);
            if (s && rec) {
                finalScore = Math.max(currentScores.get(s) || 0, currentScores.get(rec) || 0) * 0.5;
            }
        }

        // --- Critical Reservation ---
        // Score is capped at 90 unless Blacklisted or Direct Contact
        const isCriticalCandidate = activeBlacklist.has(id) || directContacts.has(id);
        if (!isCriticalCandidate) {
            finalScore = Math.min(finalScore, 89); // Keep them in High/Orange at most
        }

        r.score = Math.min(Math.round(finalScore), 100);

        // Finalize reasons from map
        r.reasonsMap.forEach((val, txt) => {
            // Filter out internal display reasons that shouldn't be in the final list
            if (txt.startsWith('Risk after Round') && r.score < 1) return;
            
            if (val >= 1) {
                const displayVal = txt.startsWith('Risk after Round') ? Math.round(val) : `+${Math.round(val)}`;
                r.reasons.add(`${txt} (${displayVal})`);
            }
        });
    });

    return riskMap;
}