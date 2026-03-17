'use client';

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [address, setAddress] = useState('0x59981d20880Ef2209bB587A624787D02aa059574');
  const [useMock, setUseMock] = useState(false);
  const [hops, setHops] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/analyze', {
        address,
        useMock,
        hops: useMock ? 3 : hops
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#02020a] text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-lg z-10 font-sans">
        {/* Glassmorphism Container */}
        <div className="bg-[#0a0a14]/60 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-10 relative overflow-hidden group">
          {/* Subtle Glow Border Effect */}
          <div className="absolute inset-0 border border-transparent group-hover:border-blue-500/10 transition-colors duration-700 pointer-events-none rounded-2xl"></div>

          <div className="mb-10 text-center">
            <h1 className="text-3xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Blockchain Anomaly
            </h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-bold">
              Core Risk Analysis Engine
            </p>
          </div>

          <div className="space-y-8">
            {/* Address Input */}
            <div className="group/input">
              <label htmlFor="address" className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em]">
                Target Neural Address
              </label>
              <div className="relative">
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={useMock}
                  className={`w-full bg-transparent border-b border-gray-800 py-3 font-mono text-sm text-blue-100 placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-all duration-300 ${useMock ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  placeholder="0x..."
                />
                <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-gradient-to-r from-blue-500 to-purple-500 group-hover/input:w-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              </div>
            </div>

            {/* Segmented Hops Selector */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-4 uppercase tracking-[0.2em]">
                Analysis Depth (Hops)
              </label>
              <div className="bg-black/40 p-1 rounded-xl border border-white/5 flex relative">
                {/* Active Indicator Slide */}
                <div
                  className="absolute top-1 bottom-1 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-lg border border-blue-500/30 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)] transition-all duration-300 ease-out z-0"
                  style={{
                    left: `calc(${(hops - 1) * 33.33}% + 4px)`,
                    width: 'calc(33.33% - 8px)'
                  }}
                ></div>

                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHops(h)}
                    disabled={useMock}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all relative z-10 ${hops === h ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'
                      } ${useMock ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {h} {h === 1 ? 'HOP' : 'HOPS'}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[9px] text-gray-600 italic text-center">
                Deep-packet inspection beyond 2 hops requires extended processing cycles.
              </p>
            </div>

            {/* Mock Toggle */}
            <div className="flex items-center justify-center pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMock}
                  onChange={(e) => setUseMock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Use Mock Data</span>
              </label>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={`w-full relative group/btn overflow-hidden rounded-xl p-px transition-all duration-300 ${loading ? 'cursor-not-allowed opacity-50' : 'hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]'
                }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 group-hover/btn:scale-105 transition-transform duration-500"></div>
              <div className="relative bg-[#0a0a14] rounded-[11px] py-4 flex items-center justify-center transition-colors group-hover/btn:bg-transparent">
                {loading ? (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-black tracking-widest text-blue-400">ANALYZING...</span>
                  </div>
                ) : (
                  <span className="text-xs font-black tracking-[0.2em] text-white">INITIALIZE SCAN</span>
                )}
              </div>
            </button>
          </div>

          {/* Feedback/Results Section */}
          {(error || result) && (
            <div className="mt-8 animate-fade-in">
              {error && (
                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl flex items-start gap-4">
                  <div className="w-1 h-full bg-red-500 rounded-full"></div>
                  <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Execution Failure</p>
                    <p className="text-xs text-red-100/70">{error}</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="p-5 bg-green-900/10 border border-green-500/20 rounded-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Neural Mapping Complete</p>
                      <p className="text-xs text-green-100/70">Processed <span className="text-white font-bold">{result.count}</span> vector sequences.</p>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-green-500/30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <a
                    href="http://localhost:3000/graph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link flex items-center justify-center gap-2 w-full py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-[10px] font-black tracking-widest text-green-400 transition-all"
                  >
                    ACCESS GRAPH INTERFACE
                    <span className="group-hover/link:translate-x-1 transition-transform">→</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-px w-8 bg-gray-800"></div>
            <div className="text-[9px] text-gray-700 font-mono tracking-widest">Peson Peson Peson</div>
            <div className="h-px w-8 bg-gray-800"></div>
          </div>
          <p className="text-gray-700 text-[10px]  leading-tight italic">
            *Academic Final Project: For Educational and Forensic Research Purposes Only.
            Algorithm: Iterative Risk Propagation Model.
          </p>
        </div>
      </div>
    </main>
  );
}
