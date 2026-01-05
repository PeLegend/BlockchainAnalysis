import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(
    NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(NEO4J_USER || 'neo4j', NEO4J_PASSWORD || 'password')
);

export async function GET() {
    const session = driver.session();

    try {
        const result = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN n, r, m
    `);

        const nodesMap = new Map();
        const linksMap = new Map();

        result.records.forEach((record) => {
            const n = record.get('n');
            const r = record.get('r');
            const m = record.get('m');

            // Helper to extract a unique ID for React Force Graph / D3
            // Uses 'address' for Wallets, 'hash' for Transactions
            const getId = (node: any) => {
                if (!node) return null;
                if (node.labels.includes('Wallet')) return node.properties.address;
                if (node.labels.includes('Transaction')) return node.properties.hash;
                return node.elementId || node.identity.toString();
            };

            const nId = getId(n);
            if (nId && !nodesMap.has(nId)) {
                const nodeData: any = {
                    id: nId,
                    group: n.labels[0] || 'Unknown',
                    ...n.properties,
                };

                // Extract timestamp and metadata for risk scoring
                if (n.properties.blockTimestamp) {
                    nodeData.timestamp = n.properties.blockTimestamp;
                    nodeData.metadata = {
                        blockTimestamp: n.properties.blockTimestamp
                    };
                }

                nodesMap.set(nId, nodeData);
            }

            // Process target node if it exists
            if (m) {
                const mId = getId(m);
                if (mId && !nodesMap.has(mId)) {
                    const nodeData: any = {
                        id: mId,
                        group: m.labels[0] || 'Unknown',
                        ...m.properties,
                    };

                    // Extract timestamp and metadata for risk scoring
                    if (m.properties.blockTimestamp) {
                        nodeData.timestamp = m.properties.blockTimestamp;
                        nodeData.metadata = {
                            blockTimestamp: m.properties.blockTimestamp
                        };
                    }

                    nodesMap.set(mId, nodeData);
                }
            }

            // Process relationship
            if (r) {
                const rId = r.elementId || r.identity.toString();
                if (!linksMap.has(rId)) {
                    const linkData: any = {
                        source: getId(n),
                        target: getId(m),
                        type: r.type,
                        ...r.properties,
                    };

                    // Extract timestamp and metadata from relationship for risk scoring
                    if (r.properties.blockTimestamp) {
                        linkData.timestamp = r.properties.blockTimestamp;
                        linkData.metadata = {
                            blockTimestamp: r.properties.blockTimestamp
                        };
                    }

                    linksMap.set(rId, linkData);
                }
            }
        });

        return NextResponse.json({
            nodes: Array.from(nodesMap.values()),
            links: Array.from(linksMap.values()),
        });

    } catch (error: any) {
        console.error('Error fetching graph data:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch graph data' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}
