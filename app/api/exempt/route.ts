import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(
    NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(NEO4J_USER || 'neo4j', NEO4J_PASSWORD || 'password')
);

// GET - Fetch all exempt addresses
export async function GET() {
    const session = driver.session();

    try {
        const result = await session.run(`
            MATCH (e:Exempt)
            RETURN e.address AS address, e.addedAt AS addedAt, e.note AS note
            ORDER BY e.addedAt DESC
        `);

        const exemptList = result.records.map((record) => ({
            address: record.get('address'),
            addedAt: record.get('addedAt'),
            note: record.get('note') || ''
        }));

        return NextResponse.json({ exemptList });

    } catch (error: any) {
        console.error('Error fetching exempt list:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch exempt list' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}

// POST - Add address to exempt list
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
            MATCH (e:Exempt {address: $address})
            RETURN e
        `, { address: normalizedAddress });

        if (existingCheck.records.length > 0) {
            return NextResponse.json({ error: 'Address already marked as Exempt (DApp/Exchange)' }, { status: 409 });
        }

        // Add to exempt list
        await session.run(`
            CREATE (e:Exempt {
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
            message: 'Address added to Exempt List',
            address: normalizedAddress
        });

    } catch (error: any) {
        console.error('Error adding to exempt list:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to add to exempt list' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}

// DELETE - Remove address from exempt list
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
            MATCH (e:Exempt {address: $address})
            DELETE e
            RETURN count(*) AS deleted
        `, { address: normalizedAddress });

        const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;

        if (deleted === 0) {
            return NextResponse.json({ error: 'Address not found in exempt list' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Address removed from exempt list'
        });

    } catch (error: any) {
        console.error('Error removing from exempt list:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to remove from exempt list' },
            { status: 500 }
        );
    } finally {
        await session.close();
    }
}
