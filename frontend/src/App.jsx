import React, { useState, useEffect } from 'react';
import {
    Shield, Activity, Users, Settings, LogOut,
    Terminal, BarChart3, Lock, AlertTriangle,
    RefreshCw, CheckCircle2
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LogExplorer from './components/LogExplorer';

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('agw_token'));
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('agw_user')));
    const [isAdmin, setIsAdmin] = useState(user?.role === 'admin');
    const [activePage, setActivePage] = useState('monitoring');

    const handleLogin = (loginData) => {
        const userData = {
            email: loginData.email,
            role: loginData.role,
            apiKey: loginData.apiKey
        };
        localStorage.setItem('agw_token', loginData.accessToken);
        localStorage.setItem('agw_user', JSON.stringify(userData));
        setToken(loginData.accessToken);
        setUser(userData);
        setIsAdmin(loginData.role === 'admin');
    };

    const handleLogout = () => {
        localStorage.removeItem('agw_token');
        localStorage.removeItem('agw_user');
        setToken(null);
        setUser(null);
        setIsAdmin(false);
    };

    if (!token) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-cyber-dark overflow-hidden font-outfit">
            {/* Sidebar */}
            <aside className="w-64 flex flex-col border-r border-cyber-border bg-cyber-card/50">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyber-accent rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <Shield className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">AGW-Audit</h1>
                        <p className="text-xs text-slate-500 font-mono">v1.0.0-PRO</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 py-4">
                    <NavItem
                        active={activePage === 'monitoring'}
                        icon={<Activity size={20} />}
                        label="Live Monitoring"
                        onClick={() => setActivePage('monitoring')}
                    />
                    <NavItem
                        active={activePage === 'users'}
                        icon={<Users size={20} />}
                        label="User Metrics"
                        onClick={() => setActivePage('users')}
                    />
                    {isAdmin && (
                        <NavItem
                            active={activePage === 'config'}
                            icon={<Settings size={20} />}
                            label="Gateway Config"
                            onClick={() => setActivePage('config')}
                        />
                    )}
                    <NavItem
                        active={activePage === 'logs'}
                        icon={<Terminal size={20} />}
                        label="Log Explorer"
                        onClick={() => setActivePage('logs')}
                    />
                </nav>

                <div className="p-4 border-t border-cyber-border m-4 bg-cyber-dark/40 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold uppercase text-white">
                            {user?.email?.[0]}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate text-white">{user?.email}</p>
                            <p className="text-[10px] uppercase text-cyber-accent font-bold tracking-wider">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors py-1 px-2"
                    >
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar">
                {activePage === 'monitoring' && <Dashboard token={token} isAdmin={isAdmin} user={user} />}
                {activePage === 'logs' && <LogExplorer token={token} isAdmin={isAdmin} user={user} />}
                {(activePage === 'users' || activePage === 'config') && (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500">
                        <Lock size={48} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-bold">Module Restricted</h2>
                        <p className="text-sm">This module is coming soon in v1.1.0</p>
                    </div>
                )}
            </main>
        </div>
    );
}

function NavItem({ icon, label, active = false, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
                ? 'bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
            {icon}
            <span className="font-medium text-sm">{label}</span>
        </button>
    );
}
