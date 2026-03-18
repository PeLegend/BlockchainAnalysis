# Blockchain Analysis System

A Next.js application designed to visualize and analyze blockchain transactions. The system traces the flow of funds using the Alchemy API and leverages a Neo4j Graph Database to identify risky behavior, calculate dynamic risk scores, and present the relationships via an interactive 2D graph interface.

## 🚀 Features

- **Interactive Graph Visualization**: Uses `react-force-graph-2d` to render dynamic networks of wallets and their transactions.
- **Deep Transaction Tracing**: Analyzes up to 3 hops of transaction history using the Alchemy API to uncover indirect associations.
- **Risk Scoring Engine**: Dynamically calculates and propagates risk through the network based on:
  - Direct and indirect interactions with Blacklisted addresses.
  - Suspicious transaction behaviors like Smurfing and High-frequency bursts.
  - High Fan-out and Fan-in ratios indicating potential money laundering.
- **Neo4j Graph Database Integration**: Efficiently maps out transaction patterns and dependencies.
- **Mock Data Engine**: Includes fallback mock data capabilities for local testing without depleting API credits.

## 🛠️ Tech Stack

- **Frontend / Backend**: Next.js 16 (React 19, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: Neo4j (Graph Database)
- **Blockchain Connectivity**: Alchemy API
- **Graph UI**: React Force Graph 2D

## ⚙️ Prerequisites

- **Node.js** v20+
- **Docker** (for running Neo4j locally)
- **Alchemy Account** (for Blockchain API keys)

## 📦 Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Rename `env.template` to `.env` and fill in your details:
   ```env
   # Alchemy API Key for fetching transactions
   ALCHEMY_API_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
   
   # Neo4j Database Configuration
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=YOUR_SECURE_PASSWORD
   ```

3. **Start the Neo4j Graph Database** (Local Option)
   Ensure Docker is running, then spin up the Neo4j instance:
   ```bash
   docker-compose up -d
   ```
   *(Note: You can access the Neo4j browser at `http://localhost:7474` using the credentials from your `.env` file.)*

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

5. **Interact with the App**
   Open [http://localhost:3000](http://localhost:3000) in your browser to begin analyzing blockchain topologies and transaction risk.

## 🧠 How Risk Scoring Works

The backend assigns dynamic scores indicating the likelihood a wallet is involved in illicit activity:
- **Base Risk**: Automatically applied if an address interacts with a known blacklist or executes burst transmissions within a short time window.
- **Graph Propagation**: Risk linearly transmits across the network (up to 3 degrees of separation), simulating real-life contamination of funds.
- **Exemptions**: Known legitimate centralized exchanges (CEXs) and DApps are ignored during scoring to prevent network-wide false positives.

## 📄 License

This project is private and intended for analysis use.
