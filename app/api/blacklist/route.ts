//// <Move To Golang>

import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(
    NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(NEO4J_USER || 'neo4j', NEO4J_PASSWORD || 'password')
);

// GET - Fetch all blacklisted addresses
export async function GET() {
    const session = driver.session();

    try {
        const result = await session.run(`
            MATCH (b:Blacklist)
            RETURN b.address AS address, b.addedAt AS addedAt, b.note AS note
            ORDER BY b.addedAt DESC
        `);

        const blacklist = result.records.map((record) => ({
            address: record.get('address'),
            addedAt: record.get('addedAt'),
            note: record.get('note') || ''
        }));

        return NextResponse.json({ blacklist });

    } catch (error: any) {
        console.error('Error fetching blacklist:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch blacklist' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}

// POST - Add address to blacklist
export async function POST(request: Request) {
    const session = driver.session();

    try {
        const body = await request.json();
        const { address, note } = body;

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        // Normalize address to lowercase
        const normalizedAddress = address.toLowerCase().trim();

        // Check if already exists
        const existingCheck = await session.run(`
            MATCH (b:Blacklist {address: $address})
            RETURN b
        `, { address: normalizedAddress });

        if (existingCheck.records.length > 0) {
            return NextResponse.json({ error: 'Address already in blacklist' }, { status: 409 });
        }

        // Add to blacklist
        await session.run(`
            CREATE (b:Blacklist {
                address: $address,
                addedAt: datetime(),
                note: $note
            })
        `, {
            address: normalizedAddress,
            note: note || ''
        });

        return NextResponse.json({
            success: true,
            message: 'Address added to blacklist',
            address: normalizedAddress
        });

    } catch (error: any) {
        console.error('Error adding to blacklist:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to add to blacklist' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}

// DELETE - Remove address from blacklist
export async function DELETE(request: Request) {
    const session = driver.session();

    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const normalizedAddress = address.toLowerCase().trim();

        const result = await session.run(`
            MATCH (b:Blacklist {address: $address})
            DELETE b
            RETURN count(*) AS deleted
        `, { address: normalizedAddress });

        const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;

        if (deleted === 0) {
            return NextResponse.json({ error: 'Address not found in blacklist' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Address removed from blacklist'
        });

    } catch (error: any) {
        console.error('Error removing from blacklist:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to remove from blacklist' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}
