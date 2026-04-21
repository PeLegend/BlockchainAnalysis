# README

... (existing content) ...

## Diagrams (Mermaid)

[Context Diagram](mmd/context-diagram.mmd)
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

[Dataflow Diagram](mmd/dataflow.mmd)
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
    UI -->| fetches data | API_Graph
    UI -->| manages | API_Blacklist
    UI -->| requests analysis | API_Analyze
    UI -->| requests path | API_Path
    
    API_Analyze -->| fetches raw txs | Alchemy
    API_Analyze -->| stores graph data | Neo4j
    
    API_Graph -->| queries nodes/links | Neo4j
    API_Path -->| queries paths | Neo4j
    API_Blacklist -->| updates status | Neo4j
    %% Internal Processing
    UI -->| executes | RiskEngine
    RiskEngine -->| updates visual risk | UI
```

[Flowchart](mmd/flowchart.mmd)
```mermaid
flowchart TD
    %% --- การทำงานหลักแบบย่อ ---
    Input["1. รับข้อมูล Target Wallet Address<br/>และเลือกโหมด (Real / Mock)"] 
    --> API_Fetch["2. ดึงข้อมูลธุรกรรมจาก Alchemy API<br/>หรือไฟล์ Mock Data"]
    
    API_Fetch --> Neo4j["3. นำเข้าข้อมูล (Ingestion)<br/>สร้าง Node และ Edge ใน Neo4j"]
    
    Neo4j --> RiskAnalysis["4. ระบบวิเคราะห์ความเสี่ยง (Risk Scoring)"]
    
    subgraph Analysis ["ขั้นตอนวิเคราะห์ความเสี่ยง (Backend)"]
        RiskAnalysis --> Rules["4.1 ตรวจสอบกฎความเสี่ยง:<br/>- Blacklist (100 คะแนน)<br/>- Fan-in / Smurfing (70 ค��แนน)<br/>- High Frequency (20 คะแนน)"]
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

[Graph Database Model](mmd/graph-database.mmd)
```mermaid
graph LR
    W1(("Wallet <br/>address: '0xAAA...'")) ) -- "[:SENT_TO]" --> T1{{"Transaction <br/>txHash: '0x123...'<br/>value: 2.5<br/>timestamp: 1698..."}}
    W2(("Wallet <br/>address: '0xBBB...'")) ) -- "[:RECEIVED_FROM]" --> T1
    W3(("Wallet <br/>address: '0xCCC...'")) ) -- "[:RECEIVED_FROM]" --> T1
    
    style W1 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style W2 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style W3 fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px
    style T1 fill:#f59e0b,color:#fff,stroke:#d97706,stroke-width:2px
```