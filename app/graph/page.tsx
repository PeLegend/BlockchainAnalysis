'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div className="text-blue-400 font-mono animate-pulse">Initializing Neural Interface...</div>
});

// --- Constants & Types ---
const LOGO_MAP: Record<string, string> = {
    'Binance': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Binance_Logo.svg',
    'Coinbase': 'https://upload.wikimedia.org/wikipedia/commons/2/25/Coinbase_Wordmark.svg', // Might need icon
    // Using standard colors or generic icons if images fail/aren't found
};

const NODE_COLORS: Record<string, string> = {
    'Wallet': '#3B82F6', // Blue
    'Transaction': '#10B981', // Emerald
    'Exchange': '#F59E0B', // Amber
    'Unicorn': '#EC4899', // Pink
};

interface GraphNode {
    id: string;
    group: string;
    tag?: string;
    value?: number;
    asset?: string;
    img?: string; // URL to logo
    x?: number;
    y?: number;
    timestamp?: number;
    [key: string]: any;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    type?: string;
    [key: string]: any;
}

const PRICE_MAP: Record<string, number> = {
    'ETH': 2500,
    'WETH': 2500,
    'BTC': 65000,
    'WBTC': 65000,
    'USDT': 1,
    'USDC': 1,
    'DAI': 1,
};

// --- Icons (SVG) ---
const SearchIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const ShareIcon = () => (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
);

export default function GraphPage() {
    // --- State ---
    const [data, setData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

    // Filters (Mock for UI)
    const [minUSD, setMinUSD] = useState(0.1);
    const [hideUnknown, setHideUnknown] = useState(false);
    const [timeRange, setTimeRange] = useState<[string, string]>(['Nov 2024', 'May 2025']);
    const [timeRangeIdx, setTimeRangeIdx] = useState<[number, number]>([0, 100]);
    const [histogramData, setHistogramData] = useState<number[]>([]);

    // Timeline View State
    const [timelineView, setTimelineView] = useState<'YEAR' | 'MONTH'>('YEAR');
    const [selectedDate, setSelectedDate] = useState<string>('2025');

    const graphRef = useRef<any>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{
        isDragging: boolean;
        mode: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        startRange: [number, number];
    }>({
        isDragging: false,
        mode: 'move',
        startX: 0,
        startRange: [0, 0]
    });

    // --- Helpers ---
    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
        e.stopPropagation();
        e.preventDefault();
        if (!timelineContainerRef.current) return;

        dragState.current = {
            isDragging: true,
            mode,
            startX: e.clientX,
            startRange: [...timeRangeIdx]
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.current.isDragging || !timelineContainerRef.current) return;

        const { mode, startX, startRange } = dragState.current;
        const containerWidth = timelineContainerRef.current.offsetWidth;
        const deltaPixels = e.clientX - startX;
        const deltaPercent = (deltaPixels / containerWidth) * 100;

        let newRange: [number, number] = [...startRange];

        if (mode === 'move') {
            const rangeWidth = startRange[1] - startRange[0];
            let newStart = startRange[0] + deltaPercent;
            let newEnd = startRange[1] + deltaPercent;

            // Clamp
            if (newStart < 0) {
                newStart = 0;
                newEnd = rangeWidth;
            }
            if (newEnd > 100) {
                newEnd = 100;
                newStart = 100 - rangeWidth;
            }
            newRange = [newStart, newEnd];
        } else if (mode === 'resize-left') {
            let newStart = startRange[0] + deltaPercent;
            // Clamp: 0 <= newStart < end - 1 (min 1% width)
            if (newStart < 0) newStart = 0;
            if (newStart > newRange[1] - 1) newStart = newRange[1] - 1;
            newRange[0] = newStart;
        } else if (mode === 'resize-right') {
            let newEnd = startRange[1] + deltaPercent;
            // Clamp: start + 1 < newEnd <= 100
            if (newEnd > 100) newEnd = 100;
            if (newEnd < newRange[0] + 1) newEnd = newRange[0] + 1;
            newRange[1] = newEnd;
        }

        setTimeRangeIdx(newRange);
    }, []);

    const handleMouseUp = useCallback(() => {
        dragState.current.isDragging = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const loadImage = (url: string) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
        });
    };

    // Generate Histogram Data Dependent on Actual Graph Data
    useEffect(() => {
        if (!data.nodes.length) return;

        // 1. Filter only transactions
        const txNodes = data.nodes.filter(n => n.group === 'Transaction' && n.timestamp);
        if (txNodes.length === 0) {
            setHistogramData(Array(200).fill(0));
            return;
        }

        // 2. Determine Range (Mock: Last 2 Years fixed)
        const NOW = Date.now();
        const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
        const start = NOW - TWO_YEARS;
        const end = NOW;
        const range = end - start;

        // 3. Create Bins (Fit to screen -> ~200 bins for smooth look)
        const binCount = 200;
        const bins = new Array(binCount).fill(0);

        txNodes.forEach(node => {
            if (!node.timestamp) return;
            const relativeTime = node.timestamp - start;
            const binIdx = Math.floor((relativeTime / range) * binCount);
            if (binIdx >= 0 && binIdx < binCount) {
                bins[binIdx]++;
            }
        });

        // 4. Normalize heights (0-100)
        const maxVal = Math.max(...bins, 1);
        const normalized = bins.map(val => (val / maxVal) * 100);

        setHistogramData(normalized);

    }, [data]);

    // --- Effects ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch data in parallel
                const [graphResponse, tagsResponse] = await axios.all([
                    axios.get('/api/graph'),
                    axios.get('/csvjson.json') // Using this for tagging
                ]);

                const graphData = graphResponse.data;
                const tagsData = tagsResponse.data as any[];

                // Process Nodes
                const processedNodes = graphData.nodes.map((node: GraphNode) => {
                    // Enrich Wallet nodes with CSV tags
                    if (node.group === 'Wallet' || node.group === 'Unknown') {
                        const tagInfo = tagsData.find((tag: any) => tag.address.toLowerCase() === node.id.toLowerCase());
                        if (tagInfo) {
                            node.group = 'Exchange';
                            node.tag = tagInfo.distinct_name;

                            // Map simple logo logic
                            const nameLower = tagInfo.distinct_name.toLowerCase();
                            if (nameLower.includes('binance')) node.img = 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png?v=025';
                            else if (nameLower.includes('okx')) node.img = 'https://cryptologos.cc/logos/okb-okb-logo.png?v=025';
                            else if (nameLower.includes('coinbase')) node.img = 'https://cryptologos.cc/logos/coinbase-coin-base-logo.png?v=025';
                            else if (nameLower.includes('uniswap')) node.img = 'https://cryptologos.cc/logos/uniswap-uni-logo.png?v=025';
                            else if (nameLower.includes('ethereum')) node.img = 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=025';
                        }
                    } else if (node.group === 'Transaction') {
                        // Maybe give transactions a specific icon?
                    }

                    return node;
                });

                // MOCK TIMESTAMPS (For demonstration until API provides them)
                // Assign random timestamp within last 2 years (approx) for Transactions
                const NOW = Date.now();
                const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
                processedNodes.forEach((node: GraphNode) => {
                    if (node.group === 'Transaction') {
                        // Random time between now and 2 years ago
                        node.timestamp = NOW - Math.random() * TWO_YEARS;
                    }
                });

                const newData = { nodes: processedNodes, links: graphData.links };
                setData(newData);

                // Preload Images
                const newImages: Record<string, HTMLImageElement> = {};
                const imageUrls = new Set(processedNodes.map((n: GraphNode) => n.img).filter(Boolean));

                // Add some default fallback or static images if we want
                imageUrls.forEach((url: any) => {
                    const img = new Image();
                    img.src = url;
                    // img.crossOrigin = "Anonymous"; // Often causes CORS issues if not configured on server, let's try without or handle error
                    newImages[url] = img;
                });
                setImages(newImages);

                // Auto-zoom
                setTimeout(() => {
                    graphRef.current?.zoomToFit(800, 100);
                }, 1000);

            } catch (err: any) {
                console.error("Data load error:", err);
                setError(err.message || 'Failed to load graph data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        fetchData();
    }, []);

    // FILTERED DATA
    const visibleData = useMemo(() => {
        const { nodes, links } = data;

        // 1. Filter Nodes
        const filteredNodes = nodes.filter(node => {
            // Always keep non-transactions unless we add specific logic
            if (node.group !== 'Transaction') return true;

            // Transaction Filter Logic
            const val = Number(node.value || 0);
            const asset = node.asset || 'ETH';
            const price = PRICE_MAP[asset.toUpperCase()] || 0;
            const usdVal = val * price;

            // Filter: Time Range (Synced with Timeline)
            // Range is last 2 years
            if (node.timestamp) {
                const NOW = Date.now();
                const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
                const totalStart = NOW - TWO_YEARS;
                const rangeDuration = TWO_YEARS;

                // timeRangeIdx is [0, 100] percentages
                const filterStart = totalStart + (rangeDuration * (timeRangeIdx[0] / 100));
                const filterEnd = totalStart + (rangeDuration * (timeRangeIdx[1] / 100));

                if (node.timestamp < filterStart || node.timestamp > filterEnd) return false;
            }

            // Filter: Hide Unknown (Price is 0 or value explicitly 'unknown')
            if (hideUnknown && price === 0) return false;

            // Filter: Min USD
            if (minUSD > 0) {
                if (price > 0 && usdVal < minUSD) return false;
            }

            return true;
        });

        const activeNodeIds = new Set(filteredNodes.map(n => n.id));

        // 2. Filter Links
        // Only keep links connecting two visible nodes
        const filteredLinks = links.filter(link => {
            const s = typeof link.source === 'object' ? link.source.id : link.source as string;
            const t = typeof link.target === 'object' ? link.target.id : link.target as string;
            return activeNodeIds.has(s) && activeNodeIds.has(t);
        });

        return { nodes: filteredNodes, links: filteredLinks };
    }, [data, minUSD, hideUnknown, timeRangeIdx]);

    // --- Renderers ---
    const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y } = node;
        if (x === undefined || y === undefined) return;

        const size = node.group === 'Exchange' ? 10 : (node.group === 'Wallet' || node.group === 'Transaction' ? 6 : 4);
        const fontSize = 12 / globalScale;

        // Draw Image if exists and requested
        if (node.img && images[node.img] && images[node.img].complete) {
            try {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI, false);
                ctx.clip();
                ctx.drawImage(images[node.img], x - size, y - size, size * 2, size * 2);
                ctx.restore();

                // Add a border/glow
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI, false);
                ctx.stroke();
            } catch (e) {
                // Fallback to circle
                ctx.fillStyle = NODE_COLORS[node.group] || '#9CA3AF';
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI, false);
                ctx.fill();
            }
        } else {
            // Standard Circle
            ctx.fillStyle = NODE_COLORS[node.group] || '#9CA3AF';

            // Neon Glow for "Active" nodes (e.g., Exchanges)
            if (node.group === 'Exchange') {
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.fillStyle;
            }

            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI, false);
            ctx.fill();

            ctx.shadowBlur = 0; // Reset
        }

        // Label on 'Exchange' or high value nodes constantly, others on hover logic handled by library tooltip usually, but we can draw names
        if (node.group === 'Exchange' && globalScale > 1.5) {
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(node.tag || '', x, y + size + 2);
            ctx.fillText(node.tag || '', x, y + size + 2);
        } else if (node.group === 'Transaction') {
            const val = Number(node.value || 0);
            const asset = node.asset || 'ETH';
            const price = PRICE_MAP[asset.toUpperCase()] || 0;
            const usdVal = val * price;

            // Format value compactly for the node
            let label = '';

            if (price > 0) {
                // USD Format
                if (usdVal >= 1000) {
                    label = '$' + (usdVal / 1000).toFixed(1) + 'k';
                } else if (usdVal >= 1) {
                    label = '$' + usdVal.toFixed(0);
                } else {
                    label = '$' + usdVal.toFixed(2);
                }
            } else {
                // Fallback to 'Unknown' if price unknown
                label = 'Unknown';
            }

            // Truncate if very long
            if (label.length > 7) label = label.slice(0, 6) + '..';

            const nodeFontSize = size / 2; // Adjusted size for potentially longer text
            ctx.font = `${nodeFontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(label, x, y);
        } else if (node.group !== 'Exchange' && node.group !== 'Transaction' && globalScale > 1.5) {
            // Draw first 6 chars of ID for Wallets INSIDE the node
            const label = node.id.slice(0, 6);
            // Use size-based font so it scales WITH the node (always fits inside)
            ctx.font = `${size / 1.5}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(label, x, y);
        }
    }, [images]);

    return (
        <main className="relative w-full h-screen bg-[#050510] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">

            {/* --- TOP HEADER / FILTER BAR --- */}
            <header className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none">
                <div className="flex items-start justify-between">

                    {/* Left Controls */}
                    <div className="flex flex-col gap-4 pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-sm text-xs font-bold tracking-wider transition-colors shadow-lg shadow-blue-900/40 clip-path-slant">
                                MORE INFO &gt;
                            </button>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="bg-gray-800/80 backdrop-blur-md border border-gray-700 text-sm rounded-full pl-10 pr-4 py-1.5 w-64 focus:outline-none focus:border-blue-500 transition-colors text-gray-300 placeholder-gray-500"
                                />
                            </div>
                        </div>

                        {/* Filter Chips */}
                        {/* Filter Chips */}
                        <div className="flex flex-wrap gap-2">
                            {/* Custom USD Filter Input */}
                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border transition-all duration-300 ${minUSD > 0 ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                                <span>USD ≥ $</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className="w-12 bg-transparent outline-none text-center border-b border-gray-600 focus:border-blue-400 appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={minUSD}
                                    onChange={(e) => setMinUSD(Math.max(0, parseFloat(e.target.value) || 0))}
                                />
                            </div>
                            <FilterChip
                                label="HIDE UNKNOWN"
                                active={hideUnknown}
                                onClick={() => setHideUnknown(prev => !prev)}
                            />
                            <FilterChip label="BASE" active />
                            <FilterChip label="FLOW ALL" />
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        {/* <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-lg">
                            <ShareIcon />
                            Share
                        </button> */}
                        {/* Toolbar Sidebar Placeholder */}
                        <div className="flex flex-col bg-gray-800/90 rounded-lg p-1 gap-2 border border-gray-700">
                            <div className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer hover:bg-gray-700 rounded">
                                <span className="text-lg">⛶</span>
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer hover:bg-gray-700 rounded">
                                <span className="text-xl">+</span>
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer hover:bg-gray-700 rounded">
                                <span className="text-xl">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- GRAPH ENGINE --- */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}

            {!loading && !error && (
                <ForceGraph2D
                    ref={graphRef}
                    graphData={visibleData}
                    backgroundColor="#050510"
                    nodeLabel={(node: any) => {
                        // Custom Tooltip based on node type
                        if (node.group === 'Transaction') {
                            const val = parseFloat(node.value || '0');
                            const asset = node.asset || 'ETH'; // Default to ETH if missing, or handle unknown

                            // Simple Mock Price Map (Use global constant)
                            // const PRICE_MAP = ... (Available globally)

                            const price = PRICE_MAP[asset.toUpperCase()] || 0;
                            const usdVal = val * price;

                            const usdDisplay = price > 0
                                ? `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : 'Unknown Price';

                            return `
            <div class="px-3 py-2 bg-[#0a0a14]/95 border border-green-500/30 rounded-lg shadow-2xl backdrop-blur-md z-50">
                <div class="text-green-400 font-bold text-xs tracking-wider mb-1">TRANSACTION VALUE</div>
                <div class="text-xl font-mono text-white font-bold">
                    ${usdDisplay}
                </div>
                <div class="text-gray-500 text-[10px] mt-0.5 font-mono flex justify-between gap-4">
                    <span>${val} ${asset}</span>
                    <span class="opacity-50">${node.id.slice(0, 6)}...</span>
                </div>
            </div>
            `;
                        }

                        // Default tooltip for wallets/exchanges
                        const label = node.tag || node.id;
                        const sub = node.group === 'Exchange' ? 'Exchange Entity' : 'Wallet Address';
                        const color = node.group === 'Exchange' ? 'text-amber-400' : 'text-blue-400';

                        return `
            <div class="px-3 py-2 bg-[#0a0a14]/95 border border-gray-700 rounded-lg shadow-xl backdrop-blur-md z-50">
                <div class="${color} font-bold text-xs tracking-wider mb-0.5">${sub.toUpperCase()}</div>
                <div class="text-white text-sm font-medium">${label}</div>
            </div>
            `;
                    }}
                    nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => drawNode(node as GraphNode, ctx, globalScale)}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        const size = node.group === 'Exchange' ? 10 : 6;
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
                        ctx.fill();
                    }}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleSpeed={0.005} // Slow, elegant flow

                    linkColor={(link: any) => {
                        return link.type === 'SENT' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)';
                    }}
                    linkWidth={1}

                />
            )}

            {/* --- BOTTOM TIMELINE --- */}
            {/* Taller container for enhanced view */}
            <div className="absolute bottom-0 left-0 right-0 z-30 h-24 bg-gradient-to-t from-[#02020a] via-[#050510] to-transparent pointer-events-none flex items-end pb-2">
                {/* Fixed "Fit to Screen" Container - overflow-hidden, w-full */}
                <div
                    ref={timelineContainerRef}
                    className="w-full h-16 bg-[#0a0a14]/90 backdrop-blur-md border-t border-gray-800 relative pointer-events-auto overflow-hidden group select-none"
                >

                    {/* View Controls (Optional - maybe hidden for 'Fit to Screen' simplicity or kept for aesthetics) */}
                    <div className="absolute top-1 left-2 z-20 flex gap-2 w-full pointer-events-none">
                        <div className="text-[10px] text-gray-500 font-mono self-center bg-[#050510]/50 px-2 rounded">
                            RANGE: <span className="text-gray-300 font-bold">Past 2 Years</span>
                        </div>
                    </div>

                    {/* Inner Content - Full Width */}
                    <div className="relative h-full w-full">

                        {/* Timeline Ticks / Histogram Mockup */}
                        <div className="absolute inset-0 flex items-end px-4 pb-4 opacity-80 gap-px overflow-hidden">
                            {/* Mock bars - Dense Ticks */}
                            {histogramData.map((height, i) => (
                                <div
                                    key={i}
                                    // Interactive bar
                                    onClick={() => {
                                        if (timelineView === 'YEAR') {
                                            setTimelineView('MONTH');
                                            setSelectedDate('Jan 2025');
                                        }
                                    }}
                                    className={`flex-1 w-full rounded-t-sm transition-all duration-300 ${height > 0 ? (height > 50 ? 'bg-blue-400' : 'bg-blue-800') : 'bg-transparent'}`}
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                />
                            ))}
                        </div>

                        {/* Timeline Labels */}
                        <div className="absolute bottom-0 w-full flex justify-between px-8 text-[10px] text-gray-500 font-mono py-1 uppercase tracking-widest select-none">
                            {timelineView === 'YEAR' ? (
                                // Dynamic Labels for Last 2 Years
                                <>
                                    <span>2 Years Ago</span>
                                    <span>1 Year Ago</span>
                                    <span>Now</span>
                                </>
                            ) : (
                                // Month View Mock Labels
                                <>
                                    <span>1</span>
                                    <span>5</span>
                                    <span>10</span>
                                    <span>15</span>
                                    <span>20</span>
                                    <span>25</span>
                                    <span>30</span>
                                </>
                            )}
                        </div>

                        {/* Selection Window Overlay (The "selected" part) */}
                        {/* Selection Window Overlay (The "selected" part) */}
                        <div
                            className="absolute top-2 bottom-2 bg-blue-500/10 backdrop-blur-[1px] cursor-grab active:cursor-grabbing flex justify-between items-center group z-10 hover:bg-blue-500/20 transition-colors border-t border-b border-blue-500/30"
                            style={{ left: `${timeRangeIdx[0]}%`, width: `${timeRangeIdx[1] - timeRangeIdx[0]}%` }}
                            onMouseDown={(e) => handleMouseDown(e, 'move')}
                        >
                            {/* Left Handle */}
                            <div
                                className="absolute left-0 -translate-x-1/2 w-3 h-6 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform z-20"
                                onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
                            >
                                <div className="w-0.5 h-3 bg-gray-400 pointer-events-none"></div>
                            </div>

                            {/* Right Handle */}
                            <div
                                className="absolute right-0 translate-x-1/2 w-3 h-6 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform z-20"
                                onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
                            >
                                <div className="w-0.5 h-3 bg-gray-400 pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </main>
    );
}

// Subcomponent for Filter Chips
// Subcomponent for Filter Chips
function FilterChip({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
            px-3 py-1 rounded-full text-[10px] font-bold tracking-wider cursor-pointer border transition-all duration-300
            ${active
                    ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }
        `}>
            {label}
        </button>
    );
}
