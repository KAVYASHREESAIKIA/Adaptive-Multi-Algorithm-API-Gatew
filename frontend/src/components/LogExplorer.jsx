import React, { useState, useEffect } from 'react';
import {
    Terminal, Search, Filter, Download,
    RefreshCw, ChevronLeft, ChevronRight,
    Shield, Globe, Clock, Server
} from 'lucide-react';

export default function LogExplorer({ token, isAdmin, user }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(0);
    const limit = 15;

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const endpoint = `/gateway-api/admin/logs?limit=${limit}&offset=${page * limit}`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': user.apiKey
                }
            });
            const data = await response.json();
            if (response.ok) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) fetchLogs();
    }, [isAdmin, page]);

    if (!isAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500">
                <Shield size={48} className="mb-4 opacity-20" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-sm">Log Explorer is only available for system administrators.</p>
            </div>
        );
    }

    const filteredLogs = logs.filter(log =>
        log.endpoint.toLowerCase().includes(filter.toLowerCase()) ||
        log.user?.email.toLowerCase().includes(filter.toLowerCase()) ||
        log.status.toString().includes(filter)
    );

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Log Explorer</h2>
                    <p className="text-slate-400">Verifying historical traffic patterns across cluster</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLogs}
                        className="p-2 border border-cyber-border rounded-lg hover:bg-white/5 transition-all text-slate-400"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="cyber-card overflow-hidden">
                <div className="p-4 border-b border-cyber-border bg-cyber-dark/30 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by endpoint, email, or status..."
                            className="w-full cyber-input pl-10 py-2 text-sm"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-cyber-dark border border-cyber-border rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-all">
                        <Filter size={16} /> Filters
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-cyber-dark border border-cyber-border rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-all">
                        <Download size={16} /> Export CSV
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-cyber-dark/50 text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-cyber-border">
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Endpoint</th>
                                <th className="px-6 py-4">Latency</th>
                                <th className="px-6 py-4">Algo</th>
                                <th className="px-6 py-4">Instance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cyber-border/50">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <RefreshCw className="animate-spin text-cyber-accent mx-auto mb-4" size={32} />
                                        <p className="text-slate-500">Initializing deep-trace...</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center text-slate-500 font-medium">
                                        No matching logs found in current buffer.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status >= 500 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                    log.status >= 400 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                        'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-200">{log.user?.email || 'Anonymous'}</span>
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">{log.user?.role || 'unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-blue-400">
                                            {log.endpoint}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-12 h-1.5 bg-cyber-dark rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${log.response_time_ms > 200 ? 'bg-red-400' : 'bg-cyber-accent'}`}
                                                        style={{ width: `${Math.min(100, log.response_time_ms / 2)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-mono text-slate-400">{log.response_time_ms}ms</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[10px] font-mono border border-slate-700 rounded px-1.5 py-0.5 text-slate-500 capitalize">
                                                {log.algorithm_used?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Server size={12} />
                                                <span className="text-[11px] font-mono">{log.gateway_instance}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-cyber-dark/30 border-t border-cyber-border flex justify-between items-center text-sm text-slate-500">
                    <div>
                        Showing <span className="text-slate-200 font-bold">{page * limit + 1}</span> to <span className="text-slate-200 font-bold">{Math.min((page + 1) * limit, totalLogsPlaceholder(logs.length))}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1 border border-cyber-border rounded hover:bg-white/5 disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            disabled={logs.length < limit}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1 border border-cyber-border rounded hover:bg-white/5 disabled:opacity-30 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function totalLogsPlaceholder(currentLength) {
    return currentLength === 0 ? 0 : 500; // Simplified for UI demonstration
}
