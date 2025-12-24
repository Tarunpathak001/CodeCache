


import React from 'react';

const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const StatCard = ({ title, value, color, children }) => (
    <div className={`bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 ${color}`}>
        <div className="flex items-center">
            <div className="p-3 rounded-full bg-gray-700 mr-4">
                {children}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-400 uppercase">{title}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    </div>
);

function StatsPanel({ stats }) {
    if (!stats) return null;

    const cacheUsage = stats.cacheSizeLimitBytes > 0 ? (stats.cacheSizeBytes / stats.cacheSizeLimitBytes) * 100 : 0;
    const hitRatio = (stats.hits + stats.misses) > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Cache Hits" value={stats.hits.toLocaleString()} color="border-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </StatCard>
                <StatCard title="Cache Misses" value={stats.misses.toLocaleString()} color="border-yellow-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </StatCard>
                <StatCard title="Bandwidth Saved" value={formatBytes(stats.bandwidthSaved)} color="border-purple-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                </StatCard>
                <StatCard title="Hit Ratio" value={`${hitRatio.toFixed(2)}%`} color="border-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </StatCard>
            </div>
            <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Cache Usage</h3>
                <div className="w-full bg-gray-700 rounded-full h-6">
                    <div className="bg-cyan-500 h-6 rounded-full" style={{ width: `${cacheUsage}%` }}></div>
                </div>
                <div className="flex justify-between text-sm mt-1 text-gray-400">
                    <span>{formatBytes(stats.cacheSizeBytes)} of {formatBytes(stats.cacheSizeLimitBytes)}</span>
                    <span>{stats.numPackages.toLocaleString()} packages</span>
                </div>
            </div>
        </div>
    );
}

export default StatsPanel;