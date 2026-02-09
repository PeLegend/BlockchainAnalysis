import { NextResponse } from 'next/server';
import axios from 'axios';

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;

interface Transfer {
    from: string;
    to: string;
    hash: string;
    value: number;
    asset: string;
    blockTimestamp?: string;
}

interface PathResult {
    found: boolean;
    hops: number;
    path: string[];
    nodes: any[];
    links: any[];
    message?: string;
    debug?: any;
}

// Fetch transactions for a wallet from Alchemy API
async function fetchWalletTransfers(address: string): Promise<Transfer[]> {
    if (!ALCHEMY_API_URL) {
        throw new Error('ALCHEMY_API_URL not configured');
    }

    const transfers: Transfer[] = [];
    console.log(`[PATH] Fetching transfers for: ${address}`);

    try {
        // Fetch outgoing transactions
        const outRes = await axios.post(ALCHEMY_API_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [{
                fromBlock: '0x0',
                toBlock: 'latest',
                fromAddress: address,
                category: ['external', 'erc20'],
                withMetadata: true,
                excludeZeroValue: true,
                maxCount: '0x64' // Limit to 100 transactions per direction
            }]
        });

        console.log(`[PATH] Outgoing response:`, outRes.data.result?.transfers?.length || 0, 'transfers');

        if (outRes.data.result?.transfers) {
            for (const tx of outRes.data.result.transfers) {
                if (tx.to) { // Make sure 'to' exists
                    transfers.push({
                        from: tx.from.toLowerCase(),
                        to: tx.to.toLowerCase(),
                        hash: tx.hash,
                        value: tx.value || 0,
                        asset: tx.asset || 'ETH',
                        blockTimestamp: tx.metadata?.blockTimestamp
                    });
                }
            }
        }

        // Fetch incoming transactions
        const inRes = await axios.post(ALCHEMY_API_URL, {
            jsonrpc: '2.0',
            id: 2,
            method: 'alchemy_getAssetTransfers',
            params: [{
                fromBlock: '0x0',
                toBlock: 'latest',
                toAddress: address,
                category: ['external', 'erc20'],
                withMetadata: true,
                excludeZeroValue: true,
                maxCount: '0x64'
            }]
        });

        console.log(`[PATH] Incoming response:`, inRes.data.result?.transfers?.length || 0, 'transfers');

        if (inRes.data.result?.transfers) {
            for (const tx of inRes.data.result.transfers) {
                if (tx.from) { // Make sure 'from' exists
                    transfers.push({
                        from: tx.from.toLowerCase(),
                        to: tx.to.toLowerCase(),
                        hash: tx.hash,
                        value: tx.value || 0,
                        asset: tx.asset || 'ETH',
                        blockTimestamp: tx.metadata?.blockTimestamp
                    });
                }
            }
        }
    } catch (err: any) {
        console.error(`[PATH] Error fetching transfers:`, err.message);
        throw err;
    }

    console.log(`[PATH] Total transfers for ${address.slice(0, 10)}...: ${transfers.length}`);
    return transfers;
}

// BFS to find shortest path between two wallets (max 3 hops)
async function findPath(startAddress: string, endAddress: string): Promise<PathResult> {
    const start = startAddress.toLowerCase();
    const end = endAddress.toLowerCase();

    console.log(`[PATH] Starting BFS from ${start.slice(0, 10)}... to ${end.slice(0, 10)}...`);

    if (start === end) {
        return {
            found: true,
            hops: 0,
            path: [start],
            nodes: [{ id: start, group: 'Wallet' }],
            links: [],
            message: 'Same wallet address'
        };
    }

    // Track visited wallets and their parent + link info
    const visited = new Map<string, { parent: string | null; link: Transfer | null }>();
    visited.set(start, { parent: null, link: null });

    // BFS queue
    let queue: string[] = [start];
    let currentHop = 0;
    const maxHops = 3;

    // Limit max wallets to explore per level to prevent explosion
    const maxWalletsPerLevel = 20;

    while (queue.length > 0 && currentHop < maxHops) {
        currentHop++;
        console.log(`[PATH] === HOP ${currentHop} === Queue size: ${queue.length}`);

        const nextQueue: string[] = [];

        // Limit queue size to prevent too many API calls
        const walletsToProcess = queue.slice(0, maxWalletsPerLevel);
        console.log(`[PATH] Processing ${walletsToProcess.length} wallets`);

        // Process all wallets at current level
        for (const wallet of walletsToProcess) {
            try {
                const transfers = await fetchWalletTransfers(wallet);

                for (const tx of transfers) {
                    // Get the neighbor (the other party in the transaction)
                    const neighbor = tx.from === wallet ? tx.to : tx.from;

                    if (!visited.has(neighbor)) {
                        visited.set(neighbor, { parent: wallet, link: tx });

                        // Check if we found the target
                        if (neighbor === end) {
                            console.log(`[PATH] FOUND! Target reached at hop ${currentHop}`);

                            // Reconstruct path
                            const path: string[] = [];
                            const pathLinks: Transfer[] = [];
                            let current: string | null = end;

                            while (current !== null) {
                                path.unshift(current);
                                const info = visited.get(current);
                                if (info?.link) {
                                    pathLinks.unshift(info.link);
                                }
                                current = info?.parent || null;
                            }

                            // Build nodes and links for visualization
                            const nodes = path.map(addr => ({
                                id: addr,
                                group: 'Wallet'
                            }));

                            const links = pathLinks.map(tx => ({
                                source: tx.from,
                                target: tx.to,
                                value: tx.value,
                                asset: tx.asset,
                                hash: tx.hash,
                                type: 'path',
                                metadata: { blockTimestamp: tx.blockTimestamp }
                            }));

                            return {
                                found: true,
                                hops: currentHop,
                                path,
                                nodes,
                                links,
                                message: `Found connection in ${currentHop} hop${currentHop > 1 ? 's' : ''}`
                            };
                        }

                        // Only add to next queue if within limit
                        if (nextQueue.length < maxWalletsPerLevel * 2) {
                            nextQueue.push(neighbor);
                        }
                    }
                }
            } catch (err: any) {
                console.error(`[PATH] Error processing wallet ${wallet.slice(0, 10)}...:`, err.message);
                // Continue with other wallets
            }
        }

        console.log(`[PATH] Next queue size: ${nextQueue.length}`);
        queue = nextQueue;
    }

    console.log(`[PATH] No path found after ${currentHop} hops. Visited ${visited.size} wallets.`);

    // No path found within 3 hops
    return {
        found: false,
        hops: 0,
        path: [],
        nodes: [],
        links: [],
        message: 'No connection found within 3 hops',
        debug: {
            visitedCount: visited.size,
            hopsSearched: currentHop
        }
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { startAddress, endAddress } = body;

        if (!startAddress || !endAddress) {
            return NextResponse.json(
                { error: 'Both startAddress and endAddress are required' },
                { status: 400 }
            );
        }

        if (!ALCHEMY_API_URL) {
            console.error('[PATH] ALCHEMY_API_URL is not configured!');
            return NextResponse.json(
                { error: 'Server configuration error: ALCHEMY_API_URL missing' },
                { status: 500 }
            );
        }

        console.log(`[PATH] ========================================`);
        console.log(`[PATH] Finding path: ${startAddress} -> ${endAddress}`);
        console.log(`[PATH] Alchemy URL configured: ${ALCHEMY_API_URL ? 'YES' : 'NO'}`);

        const result = await findPath(startAddress, endAddress);

        console.log(`[PATH] Result: ${result.found ? 'FOUND' : 'NOT FOUND'} - ${result.hops} hops`);
        console.log(`[PATH] ========================================`);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[PATH] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to find path' },
            { status: 500 }
        );
    }
}
