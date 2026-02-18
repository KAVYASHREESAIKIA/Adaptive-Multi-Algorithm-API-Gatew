import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    Zap, Shield, AlertCircle, Activity,
    RefreshCw, Server, Info, LayoutGrid, Cpu, Settings, CheckCircle2, BarChart as BarChartIcon, ShieldAlert
} from 'lucide-react';

export default function Dashboard({ token, isAdmin, user }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(5000);
    const [switching, setSwitching] = useState(false);

    const fetchStats = async () => {
        try {
            const endpoint = isAdmin ? '/gateway-api/admin/stats' : '/gateway-api/me/rate-status';
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': user.apiKey
                }
            });
            const data = await response.json();
            if (response.ok) {
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, refreshInterval);
        return () => clearInterval(interval);
    }, [isAdmin, token, refreshInterval]);

    const handleSwitchAlgorithm = async (algo) => {
        setSwitching(true);
        try {
            const response = await fetch('/gateway-api/admin/algorithm', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': user.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ algorithm: algo })
            });
            if (response.ok) await fetchStats();
        } catch (err) {
            console.error('Switch failed:', err);
        } finally {
            setSwitching(false);
        }
    };

    if (loading && !stats) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <RefreshCw className="animate-spin text-cyber-accent" size={32} />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Monitor</h2>
                    <p className="text-slate-400">Live telemetry from {stats?.gatewayInstance || 'Gateway Cluster'}</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="cyber-input py-1 text-sm bg-cyber-card"
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    >
                        <option value={2000}>Refresh: 2s</option>
                        <option value={5000}>Refresh: 5s</option>
                        <option value={10000}>Refresh: 10s</option>
                    </select>
                    <button
                        onClick={fetchStats}
                        className="p-2 border border-cyber-border rounded-lg hover:bg-white/5 transition-all text-slate-400"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Zap size={20} className="text-cyan-400" />}
                    label="Active Algorithm"
                    value={stats?.activeAlgorithm?.replace('_', ' ') || 'None'}
                    subtext="Distributed consensus"
                    color="cyan"
                />
                <StatCard
                    icon={<Shield size={20} className="text-emerald-400" />}
                    label="Circuit Status"
                    value={isAdmin ? stats?.circuitBreaker?.state : 'SECURED'}
                    subtext={isAdmin ? `${stats?.circuitBreaker?.failureCount} failures logged` : "System protected"}
                    color={isAdmin && stats?.circuitBreaker?.state === 'OPEN' ? 'red' : 'emerald'}
                />
                <StatCard
                    icon={<Activity size={20} className="text-blue-400" />}
                    label={isAdmin ? "Total Requests" : "Effective Limit"}
                    value={isAdmin ? stats?.totalRequests : stats?.effectiveLimit}
                    subtext={isAdmin ? `${stats?.recentRequests} in last hour` : "Behavior adjusted"}
                    color="blue"
                />
                <StatCard
                    icon={<ShieldAlert size={20} className="text-amber-400" />}
                    label={isAdmin ? "Blocked Users" : "Behavior Score"}
                    value={isAdmin ? stats?.blockedUsers : stats?.behaviorScore}
                    subtext={isAdmin ? "Suspicious activity detected" : `Factor: ${stats?.behaviorScore}x reduction`}
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Algorithm Controls & Status */}
                <div className="lg:col-span-1 space-y-6">
                    {isAdmin && (
                        <div className="cyber-card p-6 border-l-4 border-l-cyber-accent">
                            <div className="flex items-center gap-2 mb-6">
                                <Settings size={20} className="text-cyber-accent" />
                                <h3 className="font-bold">Strategy Engine</h3>
                            </div>
                            <div className="space-y-3">
                                {stats?.availableAlgorithms?.map(algo => (
                                    <button
                                        key={algo}
                                        disabled={switching}
                                        onClick={() => handleSwitchAlgorithm(algo)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${stats.activeAlgorithm === algo
                                            ? 'bg-cyber-accent/10 border-cyber-accent/30 text-cyber-accent'
                                            : 'bg-cyber-dark/40 border-cyber-border text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold capitalize text-sm">{algo.replace('_', ' ')}</span>
                                            <span className="text-[10px] uppercase opacity-60">
                                                {algo === 'token_bucket' ? 'Smooth Refill' : algo === 'sliding_window' ? 'Strict Precision' : 'Atomic Counter'}
                                            </span>
                                        </div>
                                        {stats.activeAlgorithm === algo ? (
                                            <CheckCircle2 size={16} />
                                        ) : (
                                            <LayoutGrid size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-4 font-mono leading-relaxed">
                                * Switching algorithm affects all {stats?.gatewayInstance ? '2' : 'multiple'} gateway instances immediately via Redis pub/sub sync.
                            </p>
                        </div>
                    )}

                    {/* Behavior Breakdown (User View) */}
                    {!isAdmin && (
                        <div className="cyber-card p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Cpu size={20} className="text-amber-400" />
                                <h3 className="font-bold">Heuristic Analysis</h3>
                            </div>
                            <div className="space-y-4">
                                <MetricBar
                                    label="Request Velocity"
                                    value={stats?.behaviorDetails?.averageRequestRate || 0}
                                    max={100}
                                    color="blue"
                                />
                                <MetricBar
                                    label="Anomaly Score"
                                    value={stats?.behaviorScore || 1}
                                    max={5}
                                    color="amber"
                                />
                            </div>
                            <div className="mt-6 p-3 bg-cyber-dark/60 rounded-lg border border-cyber-border">
                                <div className="flex items-start gap-3">
                                    <Info size={16} className="text-cyber-accent mt-0.5 shrink-0" />
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        The Adaptive Quota system reduces your hourly limit based on detection of
                                        spike-bursts and failed authentication attempts.
                                        <span className="text-cyber-accent ml-1">Learn more.</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Visualization */}
                <div className="lg:col-span-2">
                    <div className="cyber-card p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <BarChartIcon size={20} className="text-cyber-accent" />
                                <h3 className="font-bold">Traffic Telemetry</h3>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-cyber-accent"></div>
                                    <span className="text-xs text-slate-400">Throughput</span>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-cyber-danger"></div>
                                        <span className="text-xs text-slate-400">Blocked</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={generateDummySeries(stats)}>
                                    <defs>
                                        <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f27" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#475569"
                                        fontSize={10}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="#475569"
                                        fontSize={10}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#121217', borderColor: '#1f1f27', borderRadius: '8px' }}
                                        itemStyle={{ fontSize: '12px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="val"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorAcc)"
                                    />
                                    {isAdmin && (
                                        <Area
                                            type="monotone"
                                            dataKey="blocked"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            fill="transparent"
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, subtext, color }) {
    const colorMap = {
        cyan: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5',
        emerald: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
        blue: 'border-blue-500/20 text-blue-400 bg-blue-500/5',
        amber: 'border-amber-500/20 text-amber-400 bg-amber-500/5',
        red: 'border-red-500/20 text-red-400 bg-red-500/5',
    };

    return (
        <div className={`cyber-card p-5 border-l-2 transition-transform hover:-translate-y-1 ${colorMap[color] || ''}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-cyber-dark/50 rounded-lg">{icon}</div>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 tracking-wider uppercase">Live</div>
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-bold tracking-tight">{value}</h4>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">{subtext}</p>
            </div>
        </div>
    );
}

function MetricBar({ label, value, max, color }) {
    const percentage = Math.min(100, (value / max) * 100);
    const colorClass = color === 'blue' ? 'bg-cyber-accent' : 'bg-amber-400';

    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200">{value} / {max}</span>
            </div>
            <div className="h-2 w-full bg-cyber-dark rounded-full overflow-hidden border border-cyber-border">
                <div
                    className={`h-full transition-all duration-1000 ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
}

// Helper to generate visual interest on chart
function generateDummySeries(stats) {
    const base = stats?.totalRequests || stats?.remainingRequests || 0;
    return Array.from({ length: 12 }).map((_, i) => ({
        name: `${i * 5}m`,
        val: Math.floor(base * (0.8 + Math.random() * 0.4)),
        blocked: Math.floor(Math.random() * 5)
    }));
}


