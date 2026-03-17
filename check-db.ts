import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const URI = process.env.NEO4J_URI || '';
const USER = process.env.NEO4J_USER || '';
const PASSWORD = process.env.NEO4J_PASSWORD || '';

if (!URI || !USER || !PASSWORD) {
    console.error('❌ Missing environment variables. Please check .env.local');
    process.exit(1);
}

async function testConnection() {
    console.log(`Config: ${URI} | ${USER}`);
    const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    const session = driver.session();

    try {
        console.log('Connectivity check...');
        await driver.verifyConnectivity();
        console.log('✅ Connected to Neo4j successfully.');

        const result = await session.run('MATCH (n) RETURN count(n) AS count');
        const count = result.records[0].get('count').toNumber();
        console.log(`✅ Database connection active. Node count: ${count}`);

        if (count === 0) {
            console.log('⚠️ Database is empty. Did you run the "Analyze Risk" on the frontend?');
        } else {
            console.log('💡 To see the graph in browser, run this query: MATCH (n) RETURN n');
        }

    } catch (error: any) {
        console.error('❌ Connection failed:', error.message);
        if (error.code === 'ServiceUnavailable') {
            console.error('   -> Is Neo4j Server running?');
        }
    } finally {
        await session.close();
        await driver.close();
    }
}

testConnection();
