




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
        // '0xBlacklist_Exchange_Y',
        // '0xTornado_Cash_Router',
        // '0x1234567890123456789012345678901234567890'
    ].map(a => a.toLowerCase())
);

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
}

export function calculateRiskScores(
    nodes: RiskAnalysisNode[],
    links: RiskAnalysisLink[],
    blacklistAddresses?: Set<string> | string[]
): Map<string, RiskResult> {

    // Prepare blacklist set (normalize to lowercase)
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

    console.log('--- RISK SCORING START ---');
    console.log('Input Nodes:', nodes.length);
    console.log('Input Links:', links.length);
    6
    // --- Node Maps ---
    const nodeMap = new Map(
        nodes.map(n => [String(n.id).toLowerCase(), n])
    );

    const txNodes = new Set(
        nodes
            .filter(n => n.group === 'Transaction')
            .map(n => String(n.id).toLowerCase())
    );

    const txSenders = new Map<string, string>();
    const txReceivers = new Map<string, string>();

    const transfers: { from: string; to: string; time: number }[] = [];

    // --- Parse Links ---
    links.forEach(l => {
        const sVal = typeof l.source === 'object' ? l.source.id : l.source;
        const tVal = typeof l.target === 'object' ? l.target.id : l.target;

        const s = String(sVal).toLowerCase();
        const t = String(tVal).toLowerCase();

        const isSourceTx = txNodes.has(s);
        const isTargetTx = txNodes.has(t);

        // CASE A: Wallet -> Wallet
        if (!isSourceTx && !isTargetTx) {
            let time: number | undefined;

            if (l.timestamp) time = new Date(l.timestamp).getTime();
            else if (l.metadata?.blockTimestamp)
                time = new Date(l.metadata.blockTimestamp).getTime();
            else if (nodeMap.get(s)?.timestamp)
                time = new Date(nodeMap.get(s)!.timestamp!).getTime();

            // Fallback if no time found (ensure transfer is still checked for risk)
            if (!time || Number.isNaN(time)) {
                // console.log(`[RISK] Warning: Transfer ${s} -> ${t} has no timestamp. using 0.`);
                time = 0;
            }

            transfers.push({ from: s, to: t, time });
        }

        // CASE B: Wallet -> Tx
        else if (!isSourceTx && isTargetTx) {
            txSenders.set(t, s);
        }

        // CASE C: Tx -> Wallet
        else if (isSourceTx && !isTargetTx) {
            txReceivers.set(s, t);
        }
    });

    // --- Rebuild Indirect Transfers ---
    console.log(`Transaction nodes count: ${txNodes.size}`);
    console.log(`txSenders entries: ${txSenders.size}`);
    console.log(`txReceivers entries: ${txReceivers.size}`);

    txNodes.forEach(txId => {
        const sender = txSenders.get(txId);
        const receiver = txReceivers.get(txId);
        const txNode = nodeMap.get(txId);

        if (!sender || !receiver) {
            console.log(`[SKIP] Transaction ${txId.substring(0, 15)}... missing sender:${!!sender} receiver:${!!receiver}`);
            return;
        }

        let time: number | undefined;

        if (txNode?.timestamp)
            time = new Date(txNode.timestamp).getTime();
        else if (txNode?.metadata?.blockTimestamp)
            time = new Date(txNode.metadata.blockTimestamp).getTime();

        if (!time || Number.isNaN(time)) {
            time = 0;
        }

        console.log(`[TX] ${sender.substring(0, 10)} -> ${receiver.substring(0, 10)} via ${txId.substring(0, 10)}`);
        transfers.push({ from: sender, to: receiver, time });
    });

    console.log('Transfers found:', transfers.length);
    if (transfers.length > 0) {
        console.log('Sample transfer:', transfers[0]);
    }

    // --- Risk Map ---
    const riskMap = new Map<string, RiskResult>();

    const getRisk = (id: string) => {
        if (!riskMap.has(id)) {
            riskMap.set(id, { score: 0, reasons: new Set() });
        }
        return riskMap.get(id)!;
    };

    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();
    const txsByAccount = new Map<string, number[]>();

    // --- Analyze Nodes (Direct Checks) ---
    nodeMap.forEach((_, id) => {
        if (activeBlacklist.has(id)) {
            console.log(`[BLACKLIST] Node ${id} is explicitly blacklisted`);
            const risk = getRisk(id);
            risk.score = 100; // Force max score
            risk.reasons.add('Blacklisted Wallet Address');
        }
    });

    // --- Analyze Transfers ---
    transfers.forEach(tx => {
        const fromRisk = getRisk(tx.from);
        const toRisk = getRisk(tx.to);

        // RULE 1: Blacklist
        // DEBUG LOGGING
        // console.log(`Checking transfer: ${tx.from} -> ${tx.to}`);


        // if (activeBlacklist.has(tx.to) || tx.to.includes('blacklist')) {
        //     console.log(`[BLACKLIST] ${tx.from} -> ${tx.to} (Target is Blacklisted)`);
        //     fromRisk.score = 100;
        //     fromRisk.reasons.add('Transfer to Blacklist');
        // }

        if (activeBlacklist.has(tx.from)) {
            console.log(`[BLACKLIST] ${tx.from} (Blacklisted sender) -> ${tx.to}`);
            toRisk.score += RISK_RULES.BLACKLIST;
            toRisk.reasons.add('Received from Blacklist');
        }

        // Stats
        outgoing.set(tx.from, (outgoing.get(tx.from) ?? new Set()).add(tx.to));
        incoming.set(tx.to, (incoming.get(tx.to) ?? new Set()).add(tx.from));

        txsByAccount.set(tx.from, [...(txsByAccount.get(tx.from) ?? []), tx.time]);
        txsByAccount.set(tx.to, [...(txsByAccount.get(tx.to) ?? []), tx.time]);
    });

    // // RULE 2: Hybrid Fan-out (Matches both "Many Destinations" and "Repeated Concentration")
    // const interactionMap = new Map<string, Map<string, number>>(); // Sender -> { Recipient -> Count }

    // transfers.forEach(tx => {
    //     if (!interactionMap.has(tx.from)) interactionMap.set(tx.from, new Map());
    //     const recipients = interactionMap.get(tx.from)!;
    //     recipients.set(tx.to, (recipients.get(tx.to) || 0) + 1);
    // });

    // interactionMap.forEach((recipients, sender) => {
    //     // 1. One-to-Many (Classic Fan-out): Count unique recipients
    //     const uniqueRecipients = recipients.size;

    //     // 2. One-to-One (Concentrated): Count max repeated txs to one person
    //     let maxRepeated = 0;
    //     recipients.forEach((count) => {
    //         maxRepeated = Math.max(maxRepeated, count);
    //     });

    //     const isFanOut = uniqueRecipients >= FAN_THRESHOLD;
    //     const isConcentrated = maxRepeated >= FAN_THRESHOLD;

    //     if (isFanOut || isConcentrated) {
    //         console.log(`[FAN-OUT] ${sender} - Unique: ${uniqueRecipients}, MaxRepeated: ${maxRepeated}`);
    //         const risk = getRisk(sender);
    //         risk.score += RISK_RULES.SMURFING;

    //         if (isFanOut && isConcentrated) {
    //             risk.reasons.add(`High Activity (Unique ${uniqueRecipients} & Repeated ${maxRepeated})`);
    //         } else if (isFanOut) {
    //             risk.reasons.add(`Fan-out to ${uniqueRecipients} Unique Addrs`);
    //         } else {
    //             risk.reasons.add(`Repeated Tx to Single Addr (${maxRepeated}x)`);
    //         }
    //     }
    // });

    console.log('Checking Fan-in patterns...');
    incoming.forEach((senders, receiver) => {
        if (senders.size >= FAN_THRESHOLD) {
            console.log(`[SMURFING] ${receiver} has fan-in from ${senders.size} senders`);
            const risk = getRisk(receiver);
            risk.score += RISK_RULES.SMURFING;
            risk.reasons.add(`Fan-in ≥ ${FAN_THRESHOLD}`);
        }
    });

    // RULE 3: High Frequency
    console.log('Checking High Frequency patterns...');
    txsByAccount.forEach((times, accountId) => {
        if (times.length < BURST_THRESHOLD) return;

        times.sort((a, b) => a - b);

        for (let i = 0; i <= times.length - BURST_THRESHOLD; i++) {
            const diff = times[i + BURST_THRESHOLD - 1] - times[i];
            if (diff <= BURST_WINDOW_MS) {
                console.log(`[HIGH_FREQ] ${accountId} has burst of ${BURST_THRESHOLD} tx in ${diff}ms`);
                const risk = getRisk(accountId);
                risk.score += RISK_RULES.HIGH_FREQ;
                risk.reasons.add(`Burst ≥ ${BURST_THRESHOLD}/min`);
                break;
            }
        }
    });

    // RULE 4: Risk Propagation (Snapshot-based for consistency)
    // Use snapshots to prevent feedback loops and ensure same-layer nodes get equal propagation
    console.log('Applying Risk Propagation (snapshot-based)...');

    const PROPAGATION_TO_SENDER = 0.10; // 10% of destination risk (ลดจาก 20%)
    const PROPAGATION_TO_TX = 0.08;     // 8% of destination risk (ลดจาก 15%)
    const MAX_ROUNDS = 3; // Propagate up to 3 hops

    for (let round = 0; round < MAX_ROUNDS; round++) {
        console.log(`--- Propagation Round ${round + 1} ---`);

        // Decay Factor based on distance (hops)
        // Round 0 (1 hop): 100% of base rate
        // Round 1 (2 hops): 50% of base rate
        // Round 2 (3 hops): 33% of base rate
        const decayFactor = 1 / (round + 1);
        const currentSenderRate = PROPAGATION_TO_SENDER * decayFactor;
        const currentTxRate = PROPAGATION_TO_TX * decayFactor;

        // Take a SNAPSHOT of current risk scores before this round
        const riskSnapshot = new Map<string, number>();
        riskMap.forEach((risk, id) => {
            riskSnapshot.set(id, risk.score);
        });

        let changesInThisRound = false;

        transfers.forEach(tx => {
            // Use SNAPSHOT scores for propagation calculation
            const toRiskScore = riskSnapshot.get(tx.to) || 0;
            const fromRiskScore = riskSnapshot.get(tx.from) || 0;

            // Propagate from destination to sender (Backwards)
            if (toRiskScore > 0) {
                const sender = getRisk(tx.from);
                // Apply decay factor
                const propagatedScore = Math.floor(toRiskScore * currentSenderRate);

                if (propagatedScore > 0) {
                    // console.log(`[PROPAGATION R${round + 1}] ${tx.from} gets +${propagatedScore} from risky destination ${tx.to} (score: ${toRiskScore})`);
                    sender.score += propagatedScore;
                    sender.reasons.add(`Direct/Indirect link to risk`);
                    changesInThisRound = true;
                }
            }

            // Propagate from sender to destination (Forwards)
            if (fromRiskScore > 0) {
                const receiver = getRisk(tx.to);
                // Apply decay factor
                const propagatedScore = Math.floor(fromRiskScore * currentSenderRate); // Use same rate for wallet-to-wallet

                if (propagatedScore > 0) {
                    // console.log(`[PROPAGATION R${round + 1}] ${tx.to} gets +${propagatedScore} from risky sender ${tx.from} (score: ${fromRiskScore})`);
                    receiver.score += propagatedScore;
                    receiver.reasons.add(`Direct/Indirect link to risk`);
                    changesInThisRound = true;
                }
            }
        });

        // If no changes in this round, we're done
        if (!changesInThisRound) {
            console.log(`No more propagation needed after ${round + 1} rounds`);
            break;
        }
    }

    // Propagate to Transaction nodes (intermediate nodes)
    console.log('Propagating risk to Transaction nodes...');
    txNodes.forEach(txId => {
        const sender = txSenders.get(txId);
        const receiver = txReceivers.get(txId);

        if (sender && receiver) {
            const senderRisk = riskMap.get(sender);
            const receiverRisk = riskMap.get(receiver);

            if ((senderRisk && senderRisk.score > 0) || (receiverRisk && receiverRisk.score > 0)) {
                const txRisk = getRisk(txId);
                const maxConnectedRisk = Math.max(
                    senderRisk?.score || 0,
                    receiverRisk?.score || 0
                );
                const propagatedScore = Math.floor(maxConnectedRisk * PROPAGATION_TO_TX);

                if (propagatedScore > 0) {
                    console.log(`[PROPAGATION] Transaction ${txId.substring(0, 10)}... gets +${propagatedScore}`);
                    txRisk.score += propagatedScore;
                    txRisk.reasons.add(`Transaction between risky addresses`);
                }
            }
        }
    });

    // Cap score
    riskMap.forEach(r => {
        if (r.score > 100) r.score = 100;
    });

    console.log('Risk Result:', [...riskMap.entries()]);

    return riskMap;
}
