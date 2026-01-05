'use client';

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [address, setAddress] = useState('0x59981d20880Ef2209bB587A624787D02aa059574');
  const [useMock, setUseMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/analyze', { address, useMock });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">Blockchain Tx Analysis</h1>

        <div className="mb-6">
          <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-2">
            Target Wallet Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={useMock}
            className={`w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${useMock ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            placeholder="0x..."
          />
        </div>

        <div className="mb-6 flex items-center">
          <input
            id="useMock"
            type="checkbox"
            checked={useMock}
            onChange={(e) => setUseMock(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-600 ring-offset-gray-800 focus:ring-2"
          />
          <label htmlFor="useMock" className="ml-2 text-sm font-medium text-gray-300">
            Use Mock Data (Testing)
          </label>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${loading
            ? 'bg-gray-600 cursor-not-allowed text-gray-400'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/30'
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            'Analyze Risk'
          )}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm animate-fade-in">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-900/50 border border-green-700 rounded-lg animate-fade-in">
            <h3 className="text-lg font-semibold text-green-300 mb-2">Analysis Complete</h3>
            <p className="text-gray-300 mb-4">
              Processed <span className="font-bold text-white">{result.count}</span> transactions.
            </p>
            <a
              href="http://localhost:3000/graph"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
            >
              Open Graph Visualization ↗
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
