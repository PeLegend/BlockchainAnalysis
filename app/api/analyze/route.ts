//// <Move To Golang>

import { NextResponse } from 'next/server';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import fs from 'fs';
import path from 'path';

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

// Initialize Neo4j Driver
const driver = neo4j.driver(
    NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(NEO4J_USER || 'neo4j', NEO4J_PASSWORD || 'password')
);

export async function POST(request: Request) {
    const session = driver.session();

    try {
        const body = await request.json();
        const { address, useMock } = body;

        // If using mock, address is optional (or can be ignored), otherwise it's required
        if (!useMock && !address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        if (!useMock && !ALCHEMY_API_URL) {
            return NextResponse.json({ error: 'Server configuration error: ALCHEMY_API_URL missing' }, { status: 500 });
        }

        // Step 1: Reset Database (Clear old data)
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('Database cleared.');

        let transfers: any[] = [];

        if (useMock) {
            console.log('Using mock data...');
            try {
                const mockPath = path.join(process.cwd(), 'public', 'mockalchemy.json');
                const fileContent = fs.readFileSync(mockPath, 'utf-8');
                const mockData = JSON.parse(fileContent);

                if (mockData.result && mockData.result.transfers) {
                    transfers = mockData.result.transfers;
                } else {
                    console.warn("Mock data structure invalid, looking for 'transfers' array.");
                    return NextResponse.json({ error: 'Invalid mock data structure' }, { status: 500 });
                }

                console.log(`Loaded ${transfers.length} transactions from mock data.`);

            } catch (err: any) {
                console.error("Failed to load mock data:", err);
                return NextResponse.json({ error: `Failed to load mock data: ${err.message}` }, { status: 500 });
            }

        } else {
            // Helper function to fetch transfers with pagination
            const fetchTransfers = async (addr: string, direction: 'in' | 'out') => {
                let pageKey = null;
                let all: any[] = [];

                do {
                    const res: any = await axios.post(ALCHEMY_API_URL!, {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'alchemy_getAssetTransfers',
                        params: [{
                            fromBlock: '0x0',
                            toBlock: 'latest',
                            ...(direction === 'out' && { fromAddress: addr }),
                            ...(direction === 'in' && { toAddress: addr }),
                            category: ['external', 'erc20'],
                            withMetadata: true,
                            excludeZeroValue: true,
                            pageKey: pageKey ? pageKey : undefined
                        }]
                    });

                    if (res.data.error) {
                        throw new Error(res.data.error.message);
                    }

                    const result = res.data.result;
                    all.push(...result.transfers);
                    pageKey = result.pageKey;
                } while (pageKey);

                return all;
            };

            // Fetch both outgoing and incoming transactions
            const outgoing = await fetchTransfers(address, 'out');
            const incoming = await fetchTransfers(address, 'in');
            transfers = [...outgoing, ...incoming];

            console.log(`Fetched ${transfers.length} transactions (${outgoing.length} out, ${incoming.length} in).`);
        }

        // Step 3: Clear existing data and ingest into Neo4j (session already declared above)
        console.log('Re-clearing database before ingest...');

        try {
            // Clear all existing nodes and relationships again to be safe
            await session.run('MATCH (n) DETACH DELETE n');
            console.log('Neo4j database cleared successfully.');
        } catch (clearError) {
            console.error('Warning: Failed to clear database:', clearError);
            // Continue anyway - non-critical
        }

        // Using a single transaction for efficiency
        const writeTx = session.beginTransaction();

        try {
            for (const tx of transfers) {
                const fromAddr = tx.from;
                const toAddr = tx.to;
                const value = tx.value;
                const asset = tx.asset;
                const hash = tx.hash;

                // Extract blockTimestamp from metadata
                const blockTimestamp = tx.metadata?.blockTimestamp || new Date().toISOString();

                // Skip transactions with null from or to addresses to prevent Neo4j errors.
                if (!fromAddr || !toAddr) {
                    continue;
                }

                const cypher = `
                MERGE (sender:Wallet {address: $fromAddr})
                MERGE (receiver:Wallet {address: $toAddr})
                CREATE (t:Transaction {hash: $hash, value: $value, asset: $asset, blockTimestamp: $blockTimestamp})
                CREATE (sender)-[:SENT {blockTimestamp: $blockTimestamp}]->(t)-[:RECEIVED {blockTimestamp: $blockTimestamp}]->(receiver)
            `;

                await writeTx.run(cypher, {
                    fromAddr,
                    toAddr,
                    hash,
                    value: value || 0,
                    asset: asset || 'ETH',
                    blockTimestamp
                });
            }

            await writeTx.commit();
            console.log('Data ingestion complete.');

        } catch (dbError) {
            await writeTx.rollback();
            throw dbError;
        }

        return NextResponse.json({ success: true, count: transfers.length });

    } catch (error: any) {
        console.error('Analysis error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    } finally {
        await session.close();
    }
}
