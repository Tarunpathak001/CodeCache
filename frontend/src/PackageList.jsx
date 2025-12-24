


import React, { useState, useMemo } from 'react';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
};

const useSortableData = (items, config = null) => {
    const [sortConfig, setSortConfig] = useState(config);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};


const SortableHeader = ({ children, requestSort, sortConfig, name }) => {
    const getIcon = () => {
        if (!sortConfig || sortConfig.key !== name) return '↕';
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };
    return (
        <th className="p-3 text-left cursor-pointer" onClick={() => requestSort(name)}>
            {children} <span className="text-gray-500">{getIcon()}</span>
        </th>
    );
};


function PackageList({ packages }) {
    const { items, requestSort, sortConfig } = useSortableData(packages, { key: 'last_accessed', direction: 'descending' });

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <h2 className="text-2xl font-bold p-4 border-b border-gray-700">Cached Packages</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <SortableHeader requestSort={requestSort} sortConfig={sortConfig} name="name">Name</SortableHeader>
                            <th className="p-3 text-left">Version</th>
                            <SortableHeader requestSort={requestSort} sortConfig={sortConfig} name="size_bytes">Size</SortableHeader>
                            <SortableHeader requestSort={requestSort} sortConfig={sortConfig} name="hits">Hits</SortableHeader>
                            <SortableHeader requestSort={requestSort} sortConfig={sortConfig} name="last_accessed">Last Accessed</SortableHeader>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {items.map(pkg => (
                            <tr key={pkg.id} className="hover:bg-gray-700/50 transition-colors">
                                <td className="p-3 font-mono">{pkg.name}</td>
                                <td className="p-3 font-mono">{pkg.version}</td>
                                <td className="p-3">{formatBytes(pkg.size_bytes)}</td>
                                <td className="p-3 text-center">{pkg.hits}</td>
                                <td className="p-3">{formatDate(pkg.last_accessed)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {packages.length === 0 && <p className="p-4 text-center text-gray-400">No packages have been cached yet.</p>}
            </div>
        </div>
    );
}

export default PackageList;