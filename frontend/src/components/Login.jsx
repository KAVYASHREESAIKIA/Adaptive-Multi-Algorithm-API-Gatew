import React, { useState } from 'react';
import { Shield, Key, Mail, ArrowRight, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: 'admin@gmail.com',
        password: 'AdminPass123',
        role: 'admin'
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = isRegister ? '/gateway-api/auth/register' : '/gateway-api/auth/login';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Authentication failed');

            if (isRegister) {
                setIsRegister(false);
                setError('Registration successful! Please login.');
            } else {
                onLogin({ ...data, email: formData.email });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-cyber-dark to-cyber-dark">
            <div className="max-w-md w-full cyber-card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/10 blur-3xl -mr-16 -mt-16"></div>

                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-cyber-accent rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4 animate-pulse-slow">
                        <Shield size={32} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Access Gateway Control</h2>
                    <p className="text-slate-400 text-sm mt-1">Adaptive Multi-Algorithm API Dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Work Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full cyber-input pl-10"
                                placeholder="identity@corporation.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Password</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full cyber-input pl-10"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    {isRegister && (
                        <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Account Role</label>
                            <select
                                className="w-full cyber-input"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="free">Free Tier</option>
                                <option value="premium">Premium Tier</option>
                                <option value="admin">System Admin</option>
                            </select>
                        </div>
                    )}

                    {error && (
                        <div className={`p-4 rounded-lg text-sm border ${error.includes('successful')
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full cyber-button-primary mt-4 flex items-center justify-center gap-2 h-12"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                                {isRegister ? 'Initialize Account' : 'Authenticate Credentials'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        className="text-sm text-slate-500 hover:text-cyber-accent transition-colors"
                    >
                        {isRegister ? 'Already have credentials? Login' : 'Need system access? Request Registration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
