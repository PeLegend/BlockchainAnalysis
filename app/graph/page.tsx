'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { calculateRiskScores } from '../../utils/riskScoring';

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
    riskScore?: number;
    riskReasons?: string[];
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

const ShieldExclamationIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
    const [dataRange, setDataRange] = useState<[number, number]>([0, 0]);

    // Timeline View State
    const [timelineView, setTimelineView] = useState<'YEAR' | 'MONTH'>('YEAR');
    const [selectedDate, setSelectedDate] = useState<string>('2025');

    // Blacklist State
    const [blacklistAddresses, setBlacklistAddresses] = useState<string[]>([]);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [showBlacklistModal, setShowBlacklistModal] = useState(false);
    const [blacklistNote, setBlacklistNote] = useState('');
    const [isAddingToBlacklist, setIsAddingToBlacklist] = useState(false);

    // Path Discovery State
    const [startWallet, setStartWallet] = useState('');
    const [endWallet, setEndWallet] = useState('');
    const [pathResult, setPathResult] = useState<{
        found: boolean;
        hops: number;
        path: string[];
        nodes: any[];
        links: any[];
        message?: string;
    } | null>(null);
    const [isSearchingPath, setIsSearchingPath] = useState(false);
    const [pathNodeIds, setPathNodeIds] = useState<Set<string>>(new Set());

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

    // Handle adding address to blacklist
    const handleAddToBlacklist = async () => {
        if (!selectedNode || selectedNode.group === 'Transaction') return;

        setIsAddingToBlacklist(true);
        try {
            await axios.post('/api/blacklist', {
                address: selectedNode.id,
                note: blacklistNote
            });

            // Add to local state
            const newBlacklist = [...blacklistAddresses, selectedNode.id.toLowerCase()];
            setBlacklistAddresses(newBlacklist);

            // Recalculate risk scores with new blacklist
            const riskResults = calculateRiskScores(data.nodes, data.links, newBlacklist);

            // Update nodes IN-PLACE to preserve x,y positions (don't create new objects)
            data.nodes.forEach(node => {
                const risk = riskResults.get(node.id.toLowerCase());
                if (risk) {
                    node.riskScore = Math.min(risk.score, 100);
                    node.riskReasons = Array.from(risk.reasons);
                }
            });

            // Trigger re-render with same node references
            setData({ nodes: [...data.nodes], links: data.links });
            setShowBlacklistModal(false);
            setBlacklistNote('');
            setSelectedNode(null);

            console.log('[BLACKLIST] Added:', selectedNode.id);
        } catch (err: any) {
            console.error('Failed to add to blacklist:', err);
            alert(err.response?.data?.error || 'Failed to add to blacklist');
        } finally {
            setIsAddingToBlacklist(false);
        }
    };

    // Handle removing address from blacklist
    const handleRemoveFromBlacklist = async () => {
        if (!selectedNode || selectedNode.group === 'Transaction') return;

        setIsAddingToBlacklist(true);
        try {
            await axios.delete(`/api/blacklist?address=${encodeURIComponent(selectedNode.id)}`);

            // Remove from local state
            const newBlacklist = blacklistAddresses.filter(
                addr => addr.toLowerCase() !== selectedNode.id.toLowerCase()
            );
            setBlacklistAddresses(newBlacklist);

            // Recalculate risk scores with updated blacklist
            const riskResults = calculateRiskScores(data.nodes, data.links, newBlacklist);

            // Update nodes IN-PLACE to preserve positions
            data.nodes.forEach(node => {
                const risk = riskResults.get(node.id.toLowerCase());
                if (risk) {
                    node.riskScore = Math.min(risk.score, 100);
                    node.riskReasons = Array.from(risk.reasons);
                } else {
                    node.riskScore = 0;
                    node.riskReasons = [];
                }
            });

            // Trigger re-render
            setData({ nodes: [...data.nodes], links: data.links });
            setShowBlacklistModal(false);
            setSelectedNode(null);

            console.log('[BLACKLIST] Removed:', selectedNode.id);
        } catch (err: any) {
            console.error('Failed to remove from blacklist:', err);
            alert(err.response?.data?.error || 'Failed to remove from blacklist');
        } finally {
            setIsAddingToBlacklist(false);
        }
    };

    // Handle node click to show blacklist option
    const handleNodeClick = useCallback((node: GraphNode) => {
        if (node.group !== 'Transaction') {
            setSelectedNode(node);
            setShowBlacklistModal(true);
        }
    }, []);

    // Handle Path Discovery Search
    const handleFindPath = async () => {
        if (!startWallet || !endWallet) {
            alert('Please enter both wallet addresses');
            return;
        }

        setIsSearchingPath(true);
        setPathResult(null);
        setPathNodeIds(new Set());

        try {
            const response = await axios.post('/api/path', {
                startAddress: startWallet,
                endAddress: endWallet
            });

            const result = response.data;
            setPathResult(result);

            if (result.found && result.path) {
                // Set path node IDs for highlighting
                setPathNodeIds(new Set(result.path.map((addr: string) => addr.toLowerCase())));

                // Merge path nodes/links into existing data if they're not already there
                const existingNodeIds = new Set(data.nodes.map(n => n.id.toLowerCase()));
                const newNodes = result.nodes.filter((n: any) => !existingNodeIds.has(n.id.toLowerCase()));

                if (newNodes.length > 0) {
                    setData(prev => ({
                        nodes: [...prev.nodes, ...newNodes],
                        links: [...prev.links, ...result.links]
                    }));
                }

                // Zoom to fit path
                setTimeout(() => graphRef.current?.zoomToFit(500, 50), 300);
            }

            console.log('[PATH] Result:', result);
        } catch (err: any) {
            console.error('[PATH] Error:', err);
            setPathResult({
                found: false,
                hops: 0,
                path: [],
                nodes: [],
                links: [],
                message: err.response?.data?.error || 'Failed to search path'
            });
        } finally {
            setIsSearchingPath(false);
        }
    };

    // Clear path results
    const handleClearPath = () => {
        setPathResult(null);
        setPathNodeIds(new Set());
        setStartWallet('');
        setEndWallet('');
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

        // 2. Determine Range from State (or fallback to basic logical range if state not ready)
        let start = dataRange[0];
        let end = dataRange[1];

        if (start === 0 && end === 0) {
            const NOW = Date.now();
            start = NOW - (365 * 24 * 60 * 60 * 1000);
            end = NOW;
        }

        const range = end - start;
        if (range <= 0) return; // Avoid divide by zero

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

    }, [data, dataRange]);

    // --- Effects ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch data in parallel (including blacklist)
                const [graphResponse, tagsResponse, blacklistResponse] = await axios.all([
                    axios.get('/api/graph'),
                    axios.get('/csvjson.json'), // Using this for tagging
                    axios.get('/api/blacklist')
                ]);

                const graphData = graphResponse.data;
                const tagsData = tagsResponse.data as any[];

                // Store blacklist addresses
                const fetchedBlacklist = (blacklistResponse.data.blacklist || []).map((b: any) => b.address);
                setBlacklistAddresses(fetchedBlacklist);
                console.log('[PAGE] Loaded blacklist:', fetchedBlacklist.length, 'addresses');

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

                // Correctly parse timestamps from data
                processedNodes.forEach((node: GraphNode) => {
                    // If node comes from API/Neo4j, it might have 'timestamp' or 'metadata.blockTimestamp'
                    // We want node.timestamp to be a NUMBER (ms)
                    let rawTime = node.timestamp || node.metadata?.blockTimestamp;

                    if (rawTime) {
                        // Attempt to parse ISO string or use number
                        const parsed = new Date(rawTime).getTime();
                        if (!isNaN(parsed)) {
                            node.timestamp = parsed;
                        } else {
                            // Fallback if valid time exists but parse fails
                            node.timestamp = Date.now();
                        }
                    } else if (node.group === 'Transaction') {
                        // Only fallback to NOW if absolutely no data found for a Transaction
                        // (Ideally we shouldn't have this if data is good)
                        node.timestamp = Date.now();
                    }
                });

                // Calculate Data Range for Timeline
                const times = processedNodes
                    .map((n: GraphNode) => n.timestamp)
                    .filter((t: number | undefined): t is number => typeof t === 'number' && t > 0);

                let minTime = Date.now();
                let maxTime = Date.now();

                if (times.length > 0) {
                    minTime = Math.min(...times);
                    maxTime = Math.max(...times);
                    // Add some buffer (e.g. 1 week before/after)
                    const buffer = 7 * 24 * 60 * 60 * 1000;
                    minTime -= buffer;
                    maxTime += buffer;
                } else {
                    // Default to 1 year range if no data
                    minTime = Date.now() - 365 * 24 * 60 * 60 * 1000;
                }

                // Save range to state
                setDataRange([minTime, maxTime]);

                // We will handle the Histogram range update in the useEffect that depends on [data] (lines 181+)


                // Apply Risk Scoring (External Utility) - with dynamic blacklist
                const riskResults = calculateRiskScores(processedNodes, graphData.links, fetchedBlacklist);
                console.log("[PAGE] Risk Calculation Complete. Map Size:", riskResults.size);
                if (riskResults.size > 0) {
                    const firstKey = riskResults.keys().next().value;
                    if (firstKey) {
                        console.log("[PAGE] First Risk Key:", firstKey, "Data:", riskResults.get(firstKey));
                    }
                }

                // Merge Risk Results into Nodes
                console.log('[PAGE] Merging risk scores into nodes...');
                let nodesWithRisk = 0;
                let nodesWithoutRisk = 0;

                processedNodes.forEach((node: GraphNode) => {
                    const risk = riskResults.get(node.id.toLowerCase());
                    if (risk) {
                        // Always assign if exists, even if 0, to track 'checked' status
                        node.riskScore = Math.min(risk.score, 100);
                        node.riskReasons = Array.from(risk.reasons);
                        nodesWithRisk++;
                    } else {
                        // No risk data - assign 0 (safe)
                        node.riskScore = 0;
                        node.riskReasons = [];
                        nodesWithoutRisk++;

                        // Log nodes that should have risk but don't (Wallets only)
                        if (node.group === 'Wallet') {
                            console.log(`[PAGE] Warning: Wallet ${node.id} has no risk data`);
                        }
                    }
                });

                console.log(`[PAGE] Nodes with risk: ${nodesWithRisk}, without risk: ${nodesWithoutRisk}`);

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
            if (node.timestamp) {
                const totalStart = dataRange[0];
                const totalEnd = dataRange[1];
                const rangeDuration = totalEnd - totalStart;

                if (rangeDuration <= 0) return true; // Safety

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
    }, [data, minUSD, hideUnknown, timeRangeIdx, dataRange]);

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
            // Standard Circle - Default color based on group
            ctx.fillStyle = NODE_COLORS[node.group] || '#9CA3AF';

            // PATH HIGHLIGHTING - Override color if node is in active path
            const isInPath = pathNodeIds.has(node.id.toLowerCase());
            if (isInPath) {
                ctx.fillStyle = '#22C55E'; // Green-500 for path nodes
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#22C55E';
            }

            // Risk-based Color Override (only if NOT in path)
            else if (node.riskScore !== undefined && node.riskScore > 0) {
                if (node.group === 'Transaction') {
                    // Distinct Scale for Transactions (Purple/Pink) to avoid confusion with Wallets
                    if (node.riskScore >= 80) {
                        ctx.fillStyle = '#D946EF'; // [80-100] Fuchsia-500 (Critical Tx)
                    } else if (node.riskScore >= 50) {
                        ctx.fillStyle = '#A855F7'; // [50-79] Purple-500 (High-Med Tx)
                    } else {
                        ctx.fillStyle = '#C084FC'; // [1-49] Purple-400 (Low Tx)
                    }
                } else {
                    // Standard Wallet Scale (Cold-to-Hot)
                    if (node.riskScore >= 80) {
                        ctx.fillStyle = '#EF4444'; // [80-100] Critical (Red-500)
                    } else if (node.riskScore >= 60) {
                        ctx.fillStyle = '#F97316'; // [60-79] High (Orange-500)
                    } else if (node.riskScore >= 40) {
                        ctx.fillStyle = '#EAB308'; // [40-59] Medium (Yellow-500)
                    } else if (node.riskScore >= 20) {
                        ctx.fillStyle = '#06B6D4'; // [20-39] Low (Cyan-500)
                    } else {
                        ctx.fillStyle = '#3B82F6'; // [1-19] Very Low (Blue-500)
                    }
                }
            }

            // Neon Glow for high-risk nodes
            if (node.riskScore && node.riskScore >= 40) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.fillStyle;
            }

            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI, false);
            ctx.fill();

            ctx.shadowBlur = 0; // Reset
        }


        // Label on 'Exchange' or high value nodes - show tag outside
        if (node.group === 'Exchange' && globalScale > 1.5) {
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(node.tag || '', x, y + size + 2);
        }

        // Draw labels INSIDE nodes
        if (node.group === 'Transaction') {
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
        } else if (node.group === 'Wallet' || (node.group !== 'Exchange' && node.group !== 'Transaction')) {
            // Draw first 6 chars of ID for ALL Wallets INSIDE the node
            const label = node.id.slice(0, 6);
            // Use size-based font so it scales WITH the node (always fits inside)
            ctx.font = `${size / 1.5}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(label, x, y);
        }
    }, [images, pathNodeIds]);

    return (
        <main className="relative w-full h-screen bg-[#050510] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">

            {/* --- TOP HEADER / FILTER BAR --- */}
            <header className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none">
                <div className="flex items-start justify-between">

                    {/* Left Controls */}
                    <div className="flex flex-col gap-4 pointer-events-auto">
                        {/* Path Discovery Section */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-bold">PATH FINDER</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Start Wallet (0x...)"
                                    value={startWallet}
                                    onChange={(e) => setStartWallet(e.target.value)}
                                    className="bg-gray-800/80 backdrop-blur-md border border-gray-700 text-xs rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:border-green-500 transition-colors text-gray-300 placeholder-gray-500 font-mono"
                                />
                                <span className="text-gray-500">→</span>
                                <input
                                    type="text"
                                    placeholder="End Wallet (0x...)"
                                    value={endWallet}
                                    onChange={(e) => setEndWallet(e.target.value)}
                                    className="bg-gray-800/80 backdrop-blur-md border border-gray-700 text-xs rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:border-green-500 transition-colors text-gray-300 placeholder-gray-500 font-mono"
                                />
                                <button
                                    onClick={handleFindPath}
                                    disabled={isSearchingPath || !startWallet || !endWallet}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isSearchingPath || !startWallet || !endWallet
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40'
                                        }`}
                                >
                                    {isSearchingPath ? '🔄 Searching...' : '🔍 Find Path'}
                                </button>
                                {pathResult && (
                                    <button
                                        onClick={handleClearPath}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>
                            {/* Path Result Panel */}
                            {pathResult && (
                                <div className={`mt-2 p-3 rounded-lg border ${pathResult.found
                                    ? 'bg-green-900/30 border-green-500/50'
                                    : 'bg-red-900/30 border-red-500/50'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-sm font-bold ${pathResult.found ? 'text-green-400' : 'text-red-400'}`}>
                                            {pathResult.found ? `✓ Connected (${pathResult.hops} Hop${pathResult.hops > 1 ? 's' : ''})` : '✗ Not Connected'}
                                        </span>
                                    </div>
                                    {pathResult.found && pathResult.path.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
                                            {pathResult.path.map((addr, idx) => (
                                                <span key={addr} className="flex items-center gap-1">
                                                    <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">
                                                        {addr.slice(0, 6)}...{addr.slice(-4)}
                                                    </span>
                                                    {idx < pathResult.path.length - 1 && (
                                                        <span className="text-green-400">→</span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {pathResult.message && !pathResult.found && (
                                        <p className="text-xs text-gray-400">{pathResult.message}</p>
                                    )}
                                </div>
                            )}
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

                            // Format Timestamp
                            const dateObj = node.timestamp ? new Date(node.timestamp) : null;
                            const dateStr = dateObj ? dateObj.toLocaleDateString() : '';
                            const timeStr = dateObj ? dateObj.toLocaleTimeString() : '';

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
                ${dateObj ? `
                <div class="mt-2 text-gray-400 text-[10px] font-mono border-t border-gray-700/50 pt-1 flex justify-between uppercase tracking-wider">
                    <span>${dateStr}</span>
                    <span>${timeStr}</span>
                </div>
                ` : ''}
            </div>
            `;
                        }

                        // Default tooltip for wallets/exchanges with RISK DISPLAY
                        const label = node.tag || node.id;
                        const sub = node.group === 'Exchange' ? 'Exchange Entity' : 'Wallet Address';
                        const color = node.group === 'Exchange' ? 'text-amber-400' : 'text-blue-400';

                        // Risk Section (ALWAYS SHOW)
                        const score = node.riskScore || 0;
                        let riskLevel = 'SAFE';
                        let riskColor = 'text-green-500';
                        let riskBg = 'bg-green-500/10 border-green-500/30';

                        if (score >= 100) {
                            riskLevel = 'CRITICAL';
                            riskColor = 'text-red-500';
                            riskBg = 'bg-red-500/10 border-red-500/30';
                        } else if (score >= 50) {
                            riskLevel = 'HIGH';
                            riskColor = 'text-orange-500';
                            riskBg = 'bg-orange-500/10 border-orange-500/30';
                        } else if (score > 0) {
                            riskLevel = 'MODERATE';
                            riskColor = 'text-yellow-400';
                            riskBg = 'bg-yellow-500/10 border-yellow-500/30';
                        }

                        const reasons = node.riskReasons && node.riskReasons.length > 0
                            ? node.riskReasons.map((r: string) => `<div class="flex items-start gap-1"><span class="mt-1 w-1 h-1 rounded-full bg-current opacity-70"></span><span>${r}</span></div>`).join('')
                            : '<div class="opacity-50 italic">No anomalies detected</div>';

                        const riskHtml = `
                            <div class="mt-3 pt-2 border-t border-gray-700/50">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-xs font-bold text-gray-400 tracking-wider">RISK SCORE</div>
                                    <div class="px-2 py-0.5 rounded text-[10px] font-bold border ${riskBg} ${riskColor}">
                                        ${score}/100 • ${riskLevel}
                                    </div>
                                </div>
                                <div class="text-gray-400 text-[10px] font-mono leading-relaxed max-w-[200px]">
                                    ${reasons}
                                </div>
                            </div>
                        `;

                        return `
            <div class="px-4 py-3 bg-[#0a0a14]/95 border border-gray-700/80 rounded-xl shadow-2xl backdrop-blur-md z-50 min-w-[240px]">
                <div class="${color} font-bold text-xs tracking-wider mb-1 flex items-center gap-2">
                    ${sub.toUpperCase()}
                </div>
                <div class="text-white text-sm font-medium break-all text-wrap font-mono mb-1">${label}</div>
                ${riskHtml}
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
                    onNodeClick={(node: any) => handleNodeClick(node as GraphNode)}
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

                    {/* View Controls */}
                    <div className="absolute top-1 left-2 z-20 flex gap-2 w-full pointer-events-none">
                        <div className="text-[10px] text-gray-500 font-mono self-center bg-[#050510]/50 px-2 rounded">
                            RANGE: <span className="text-gray-300 font-bold">
                                {dataRange[0] > 0 ? `${new Date(dataRange[0]).toLocaleDateString()} - ${new Date(dataRange[1]).toLocaleDateString()}` : 'Loading...'}
                            </span>
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
                                // Dynamic Labels based on dataRange
                                <>
                                    <span>{dataRange[0] > 0 ? new Date(dataRange[0]).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}</span>
                                    <span>{dataRange[0] > 0 ? new Date((dataRange[0] + dataRange[1]) / 2).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}</span>
                                    <span>{dataRange[1] > 0 ? new Date(dataRange[1]).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}</span>
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

            {/* --- BLACKLIST MODAL --- */}
            {showBlacklistModal && selectedNode && (() => {
                const isInBlacklist = blacklistAddresses.some(
                    addr => addr.toLowerCase() === selectedNode.id.toLowerCase()
                );

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className={`bg-[#0a0a14] border ${isInBlacklist ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]`}>

                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-full ${isInBlacklist ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} flex items-center justify-center`}>
                                    <ShieldExclamationIcon />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">
                                        {isInBlacklist ? 'Remove from Blacklist' : 'Add to Blacklist'}
                                    </h3>
                                    <p className="text-gray-400 text-xs">
                                        {isInBlacklist ? 'This address is currently blacklisted' : 'Mark this address as risky'}
                                    </p>
                                </div>
                            </div>

                            {/* Address Display */}
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                                <div className="text-gray-400 text-[10px] tracking-wider mb-1">WALLET ADDRESS</div>
                                <div className="text-white font-mono text-sm break-all">{selectedNode.id}</div>
                                {selectedNode.tag && (
                                    <div className="mt-2 text-amber-400 text-xs">
                                        Tag: {selectedNode.tag}
                                    </div>
                                )}
                                {isInBlacklist && (
                                    <div className="mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded inline-block">
                                        ⚠ Currently Blacklisted
                                    </div>
                                )}
                            </div>

                            {/* Note Input - Only show for adding */}
                            {!isInBlacklist && (
                                <div className="mb-4">
                                    <label className="text-gray-400 text-xs block mb-2">Note (optional)</label>
                                    <input
                                        type="text"
                                        value={blacklistNote}
                                        onChange={(e) => setBlacklistNote(e.target.value)}
                                        placeholder="e.g., Known scam wallet, Phishing..."
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors"
                                    />
                                </div>
                            )}

                            {/* Warning/Info */}
                            <div className={`${isInBlacklist ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'} border rounded-lg p-3 mb-4 text-xs`}>
                                {isInBlacklist ? (
                                    <><strong>Info:</strong> Removing this address will recalculate risk scores for all connected addresses.</>
                                ) : (
                                    <><strong>Warning:</strong> Adding this address to the blacklist will mark it as high-risk (100 score) and propagate risk to connected addresses.</>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowBlacklistModal(false);
                                        setSelectedNode(null);
                                        setBlacklistNote('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                {isInBlacklist ? (
                                    <button
                                        onClick={handleRemoveFromBlacklist}
                                        disabled={isAddingToBlacklist}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isAddingToBlacklist ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Removing...
                                            </>
                                        ) : (
                                            <>Remove from Blacklist</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleAddToBlacklist}
                                        disabled={isAddingToBlacklist}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isAddingToBlacklist ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Adding...
                                            </>
                                        ) : (
                                            <>Add to Blacklist</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
