# BlockchainAnalysis

โปรเจกต์วิเคราะห์เส้นทางธุรกรรมบนบล็อกเชน โดยใช้
- Next.js + TypeScript สำหรับเว็บแอป
- Neo4j สำหรับจัดเก็บและวิเคราะห์ความสัมพันธ์แบบกราฟ
- Alchemy API สำหรับดึงข้อมูลธุรกรรม

## ความสามารถหลัก

- วิเคราะห์ความเสี่ยงของที่อยู่กระเป๋าเงิน
- ค้นหาเส้นทางธุรกรรม (Path/Graph) ระหว่าง Address
- จัดการรายการ Blacklist / Exempt ผ่าน API
- แสดงผลกราฟธุรกรรมบนหน้าเว็บ

## ความต้องการระบบ

ใช้งานตามเอกสาร [SYSTEM_REQUIREMENTS.md](SYSTEM_REQUIREMENTS.md)

ขั้นต่ำแนะนำ:
- Node.js 18+
- npm 9+
- Docker Desktop (ถ้าจะรันแบบ Container)

## การเตรียมค่า Environment

1. สร้างไฟล์ `.env` ที่ root ของโปรเจกต์
2. คัดลอกค่าจากไฟล์ `env.template` ลงใน `.env`
3. แก้ค่าให้เป็นของคุณเอง

ตัวอย่างคำสั่ง:

```bash
cp env.template .env
```

สำหรับ Windows PowerShell:

```powershell
Copy-Item env.template .env
```

ตัวแปรสำคัญ:

- `ALCHEMY_API_URL` : URL ของ Alchemy API
- `NEO4J_URI` : URI สำหรับเชื่อมต่อ Neo4j
- `NEO4J_USERNAME` : ชื่อผู้ใช้ Neo4j
- `NEO4J_PASSWORD` : รหัสผ่าน Neo4j
- `NEO4J_DATABASE` : ชื่อฐานข้อมูล (ปกติคือ `neo4j`)

## วิธีรันโปรแกรม (Local)

### 1) ติดตั้ง Dependencies

```bash
npm install
```

### 2) รันโหมดพัฒนา

```bash
npm run dev
```

### 3) เปิดเว็บ

ไปที่ `http://localhost:3000`

## วิธีรันโปรแกรมด้วย Docker Compose

ในโหมดนี้จะรันทั้ง Web และ Neo4j พร้อมกัน

### 1) ตรวจสอบไฟล์ `.env`

ต้องมีค่า `NEO4J_PASSWORD` และตัวแปรอื่นที่จำเป็นครบ

### 2) Build และ Start

```bash
docker compose up --build -d
```

### 3) ตรวจสอบ Service

```bash
docker compose ps
```

### 4) เข้าใช้งาน

- Web App: `http://localhost:3000`
- Neo4j Browser: `http://localhost:7474`

### 5) หยุดการทำงาน

```bash
docker compose down
```

## คำสั่งที่ใช้บ่อย

```bash
npm run dev      # รันโหมดพัฒนา
npm run build    # สร้าง production build
npm run start    # รัน production server
npm run lint     # ตรวจ lint
```

## โครงสร้างโปรเจกต์แบบย่อ

```text
app/
	api/
		analyze/
		blacklist/
		exempt/
		graph/
		path/
graph/
utils/
public/
docker-compose.yml
Dockerfile
env.template
```

## Diagrams (Mermaid)

> GitHub จะแสดง Mermaid จากใน README โดยตรง (โค้ดบล็อก ```mermaid) ด้านล่างนี้คือไดอะแกรมหลักที่อยู่ในโฟลเดอร์ `mmd/`

### 1) Context Diagram

ไฟล์: `mmd/context-diagram.mmd`

```mermaid
graph TD
    %% Define Users
    User["User / Analyst"]
    Admin["Administrator"]

    %% Define System
    System["Blockchain Analysis System<br/>(Next.js Application)"]

    %% Define External Systems
    Blockchain["Blockchain Network / Node<br/>(e.g., Ethereum, Bitcoin)"]
    MarketData["Market Data API<br/>(e.g., CoinGecko, Binance)"]
    Auth["Identity Provider<br/>(e.g., Google, Auth0)"]
    Notify["Notification Service<br/>(e.g., Email, Discord)"]

    %% Relationships
    User -->|"View Graphs & Analyze Data"| System
    Admin -->|"Configure System Settings"| System

    System -->|"Fetch Blocks & Transactions"| Blockchain
    System -->|"Fetch Token Prices"| MarketData
    System -->|"Authenticate Users"| Auth
    System -->|"Send Alerts"| Notify

    %% Styling
    style System fill:,stroke:#333,stroke-width:4px
    style Blockchain fill:,stroke:#333
    style MarketData fill:,stroke:#333
    style Auth fill:,stroke:#333
    style Notify fill:,stroke:#333
```

### 2) Dataflow Diagram

ไฟล์: `mmd/dataflow.mmd`

```mermaid
graph TD
    User["User / Client Browser"]

    subgraph Frontend ["Next.js Client (React)"]
        UI["Graph Visualization <br> (react-force-graph-2d)"]
        RiskEngine["Risk Scoring Engine <br> (Client-side Logic)"]
        State["State Management <br> (Filters, Blacklist, Path)"]
    end
    subgraph Backend ["Next.js API Routes"]
        API_Analyze["/api/analyze <br> Data Ingestion"]
        API_Graph["/api/graph <br> Data Retrieval"]
        API_Blacklist["/api/blacklist <br> Management"]
        API_Path["/api/path <br> Pathfinding"]
    end
    subgraph Database ["Data Layer"]
        Neo4j[("Neo4j Graph DB")]
    end
    subgraph External ["External Services"]
        Alchemy["Alchemy API <br> (Blockchain Data)"]
    end

    %% Data Flow
    User -->|Interacts| UI
    UI -->|fetches data| API_Graph
    UI -->|manages| API_Blacklist
    UI -->|requests analysis| API_Analyze
    UI -->|requests path| API_Path

    API_Analyze -->|fetches raw txs| Alchemy
    API_Analyze -->|stores graph data| Neo4j

    API_Graph -->|queries nodes/links| Neo4j
    API_Path -->|queries paths| Neo4j
    API_Blacklist -->|updates status| Neo4j

    %% Internal Processing
    UI -->|executes| RiskEngine
    RiskEngine -->|updates visual risk| UI
```

### 3) Flowchart

ไฟล์: `mmd/flowchart.mmd`

```mermaid
flowchart TD
    %% --- การทำงานหลักแบบย่อ ---
    Input["1. รับข้อมูล Target Wallet Address<br/>และเลือกโหมด (Real / Mock)"]
    --> API_Fetch["2. ดึงข้อมูลธุรกรรมจาก Alchemy API<br/>หรือไฟล์ Mock Data"]

    API_Fetch --> Neo4j["3. นำเข้าข้อมูล (Ingestion)<br/>สร้าง Node และ Edge ใน Neo4j"]

    Neo4j --> RiskAnalysis["4. ระบบวิเคราะห์ความเสี่ยง (Risk Scoring)"]

    subgraph Analysis ["ขั้นตอนวิเคราะห์ความเสี่ยง (Backend)"]
        RiskAnalysis --> Rules["4.1 ตรวจสอบกฎความเสี่ยง:<br/>- Blacklist (100 คะแนน)<br/>- Fan-in / Smurfing (70 คะแนน)<br/>- High Frequency (20 คะแนน)"]
        Rules --> Propagation["4.2 กระจายคะแนนความเสี่ยง (Risk Propagation)<br/>ไปยังกระเป๋าที่เชื่อมต่อ (สูงสุด 3 Hops)"]
    end

    Propagation --> GraphView["5. แสดงผลกราฟเครือข่าย 3 มิติ<br/>ไฮไลต์สี Node ตามระดับความเสี่ยง"]

    GraphView --> UserInteract{"6. การใช้งานเพิ่มเติม"}

    UserInteract -- "คลิกดูข้อมูล" --> Details["ดูรายละเอียด Wallet / Transaction"]
    UserInteract -- "วิเคราะห์เส้นทาง" --> Pathfinding["ค้นหาเส้นทางสั้นที่สุดระหว่าง 2 กระเป๋า"]
    UserInteract -- "จัดการข้อมูล" --> Blacklist["เพิ่ม/ลด บัญชีดำ (Blacklist)"]

    classDef default fill:#f9fafb,stroke:#d1d5db,stroke-width:2px,color:#1f2937;
    classDef process fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a;

    class API_Fetch,Neo4j,Analysis process;
```

### 4) Graph Database Model

ไฟล์: `mmd/graph-database.mmd`

```mermaid
graph LR
    W1(("Wallet <br/>address: '0xAAA...'")) -- "[:SENT_TO]" --> T1{{"Transaction <br/>txHash: '0x123...'<br/>value: 2.5<br/>timestamp: 1698..."}}
    W2(("Wallet <br/>address: '0xBBB...'")) -- "[:RECEIVED_FROM]" --> T1
    W3(("Wallet <br/>address: '0xCCC...'")) -- "[:RECEIVED_FROM]" --> T1

    style W1 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style W2 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style W3 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style T1 fill:#f59e0b,color:#fff,stroke:#d97706,stroke-width:2px
```

## หมายเหตุด้านความปลอดภัย

- ไฟล์ `.env` ถูกตั้งค่าใน `.gitignore` แล้ว และไม่ควรถูก commit ขึ้น Git
- ห้ามใส่ API Key หรือรหัสผ่านจริงใน README
- หากเคยเผลอเผยแพร่ข้อมูลลับ ให้รีบเปลี่ยน (rotate) คีย์/รหัสผ่านทันที

## ปัญหาที่พบบ่อย

### 1) ต่อ Neo4j ไม่ได้
- ตรวจค่า `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- ถ้ารันผ่าน Docker Compose ให้ใช้ host ตาม service ที่กำหนดในไฟล์ compose

### 2) เปิดเว็บไม่ได้ที่พอร์ต 3000
- ตรวจว่ามีโปรแกรมอื่นใช้พอร์ต 3000 อยู่หรือไม่
- เช็กสถานะ container ด้วย `docker compose ps`

### 3) Build ไม่ผ่าน
- ลบโฟลเดอร์ `node_modules` และติดตั้งใหม่
- ใช้ Node.js เวอร์ชันที่รองรับ (แนะนำ 18+)