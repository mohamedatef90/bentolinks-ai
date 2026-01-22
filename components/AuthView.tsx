
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, testSupabaseConnection } from '../services/supabase';

const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<'checking' | 'active' | 'inactive'>('checking');

  useEffect(() => {
    // Check for saved login
    const savedEmail = localStorage.getItem('bento-remember-email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    const checkConnection = async () => {
      const active = await testSupabaseConnection();
      setConnStatus(active ? 'active' : 'inactive');
    };
    checkConnection();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError("Cloud services are currently offline. Local Mode is active.");
      return;
    }
    
    setLoading(true);
    setError(null);

    // Save login logic
    if (rememberMe) {
      localStorage.setItem('bento-remember-email', email);
    } else {
      localStorage.removeItem('bento-remember-email');
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification protocol initiated. Check your inbox to finalize authorization.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#050505] text-white selection:bg-neon-accent selection:text-black">
      {/* Refined Background Elements - No Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#c1ff00]/5 rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full"></div>
        {/* High-fidelity grid */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        {/* Vertical Scanline */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
      </div>

      <div className="w-full max-w-lg perspective-1000 z-10">
        <div className="bento-card p-10 md:p-14 relative shadow-[0_40px_120px_rgba(0,0,0,0.9)] border-white/10 bg-[#0c0c0e] transition-all duration-500">
          
          {/* Header Section */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="relative mb-6 group">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center relative shadow-2xl transition-transform group-hover:scale-110 duration-500 overflow-hidden">
                 <img src="https://i.postimg.cc/L5YGmDmQ/0058ae6839e5283293bcada1598f2309.jpg" className="w-11 h-11 object-contain" alt="BentoLinks Logo" />
              </div>
            </div>
            
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-2 flex items-center gap-2">
              {isLogin ? 'Protocol: Login' : 'Protocol: Register'}
              <span className="px-1.5 py-0.5 bg-neon-accent text-black text-[8px] rounded font-black tracking-widest uppercase">Secured</span>
            </h1>
            
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              {isLogin ? 'Access your cloud-synced resource vault' : 'Create a new project-based operator identity'}
            </p>

            {/* System Status Indicator */}
            <div className="flex items-center gap-3 py-1.5 px-4 bg-white/5 rounded-full border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${connStatus === 'active' ? 'bg-emerald-500' : connStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                  {connStatus === 'active' ? 'Supabase Linked' : connStatus === 'checking' ? 'Syncing...' : 'Local Cache Only'}
                </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Operator Email</label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600"></i>
                <input 
                  type="email" 
                  required
                  className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all font-bold placeholder:text-zinc-700"
                  placeholder="name@nexus.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between px-1">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Access Key</label>
                {isLogin && <button type="button" className="text-[8px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest">Forgot?</button>}
              </div>
              <div className="relative group">
                <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-neon-accent transition-colors"></i>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-12 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all font-bold placeholder:text-zinc-700"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-neon-accent border-neon-accent' : 'border-white/10 bg-white/5 group-hover:border-white/20'}`}>
                    {rememberMe && <i className="fa-solid fa-check text-[10px] text-black"></i>}
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Remember Identity</span>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full bg-white text-black font-black py-5 rounded-xl uppercase text-[10px] tracking-[0.3em] hover:bg-neon-accent hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-4 shadow-xl"
            >
              {loading ? (
                <i className="fa-solid fa-spinner fa-spin text-sm"></i>
              ) : (
                <>
                  <span>{isLogin ? 'Enter Hub' : 'Confirm Registration'}</span>
                  <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-1"></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-neon-accent transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              {isLogin ? (
                <>Need to create an account? <span className="text-white hover:underline">Sign up</span></>
              ) : (
                <>Already have an account? <span className="text-white hover:underline">Log in</span></>
              )}
            </button>
          </div>
        </div>
        
        {/* Footer Credit */}
        <p className="mt-8 text-center text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em]">
          BentoLinks Neural Hub &copy; 2025
        </p>
      </div>
    </div>
  );
};

export default AuthView;
