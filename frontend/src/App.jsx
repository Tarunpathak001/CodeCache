


import React, { useState, useEffect, useCallback } from 'react';
import StatsPanel from './StatsPanel.jsx';
import PackageList from './PackageList.jsx';

// Use backend port from config during build, fallback for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [stats, setStats] = useState(null);
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // Always show demo data for GitHub Pages
    console.log('Loading demo data for GitHub Pages');
    setStats({
      hits: 1247,
      misses: 89,
      bandwidthSaved: 48318382080, // 45.2 GB in bytes
      cacheSizeBytes: 2469606195, // 2.3 GB in bytes
      cacheSizeLimitBytes: 5368709120, // 5 GB in bytes
      numPackages: 156,
      npmPackages: 98,
      pypiPackages: 58,
      lastUpdated: new Date().toISOString()
    });
    setPackages([
      { id: 1, name: 'react', version: '18.2.0', size_bytes: 91389952, hits: 45, registry: 'npm', last_accessed: new Date(Date.now() - 2*60*1000).toISOString() },
      { id: 2, name: 'lodash', version: '4.17.21', size_bytes: 1468006, hits: 23, registry: 'npm', last_accessed: new Date(Date.now() - 5*60*1000).toISOString() },
      { id: 3, name: 'requests', version: '2.31.0', size_bytes: 524288, hits: 18, registry: 'pypi', last_accessed: new Date(Date.now() - 8*60*1000).toISOString() },
      { id: 4, name: 'express', version: '4.18.2', size_bytes: 2202009, hits: 12, registry: 'npm', last_accessed: new Date(Date.now() - 12*60*1000).toISOString() },
      { id: 5, name: 'numpy', version: '1.24.3', size_bytes: 16777216, hits: 9, registry: 'pypi', last_accessed: new Date(Date.now() - 15*60*1000).toISOString() }
    ]);
    setError('🌐 Demo Mode: Showing sample data (Backend not connected)');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear the entire cache? This cannot be undone.')) {
        try {
            const res = await fetch(`${API_BASE_URL}/clear-cache`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to clear cache');
            alert('Cache cleared successfully!');
            fetchData(); 
        } catch (e) {
            setError(e.message);
        }
    }
  };
  
  const handleExportStats = () => {
    if (!stats) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(stats, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `codecache-stats-${new Date().toISOString()}.json`;
    link.click();
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-4 md:mb-0">
            📦 CodeCache Pro Dashboard
          </h1>
          <div className="flex space-x-2">
            <button onClick={handleExportStats} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">Export Stats</button>
            <button onClick={handleClearCache} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">Clear Cache</button>
          </div>
        </header>

        {loading && <p className="text-center text-xl">Loading dashboard...</p>}
        {error && (
          <div className={`${error.includes('Demo Mode') ? 'bg-blue-800 border-blue-600' : 'bg-red-800 border-red-600'} border text-white px-4 py-3 rounded relative mb-4`} role="alert">
            {error}
          </div>
        )}
        
        {!loading && (
            <>
                <StatsPanel stats={stats} />
                <PackageList packages={packages} />
            </>
        )}
      </div>
    </div>
  );
}

export default App;