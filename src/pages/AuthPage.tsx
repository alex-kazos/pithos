import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleButton } from '../components/auth/GoogleButton';

const STEPS = [
  { n: 1, label: 'Account' },
  { n: 2, label: 'Store' },
];

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 font-archivo">
      <div className="w-full max-w-[420px] flex flex-col items-center p-8 sm:p-10 rounded-2xl bg-canvas-2 border border-white/[0.07] text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center font-bold text-sm text-canvas">S</div>
          <span className="font-bold text-base tracking-tight">StockPilot</span>
        </div>

        <h1 className="mt-5 text-[23px] font-semibold tracking-tight text-center">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45 text-center max-w-[320px]">
          {isSignUp
            ? "Connect a store and StockPilot starts reading its last twelve months on its own."
            : 'Sign in to pick up your recommendation queue where you left it.'}
        </p>

        {error && (
          <div className="mt-5 w-full p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 w-full flex flex-col gap-3.5">
          {isSignUp && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Full name</span>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Alex Kazos"
                  className="w-full pl-10 pr-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] text-white placeholder-white/30 outline-none focus:border-accent/60"
                  required
                />
              </div>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-white/60">Email</span>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between text-[11.5px] font-medium text-white/60">
              Password
              {isSignUp && <span className="text-[11px] font-normal text-white/35">min. 8 characters</span>}
            </span>
            <div className="flex items-center gap-2 pl-3.5 pr-2.5 rounded-[9px] border border-white/[0.09] bg-white/[0.03] focus-within:border-accent/60">
              <Lock className="w-4 h-4 text-white/35 flex-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="flex-1 min-w-0 py-[11px] bg-transparent text-[13px] text-white placeholder-white/30 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="flex-none text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              'Create account'
            ) : (
              'Sign in'
            )}
          </button>

          <div className="flex items-center gap-2.5 my-0.5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[11px] text-white/35">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <GoogleButton />
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-5 text-[12.5px] font-medium text-accent-soft hover:text-white transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'New to StockPilot? Create an account'}
        </button>

        <div className="mt-6 pt-5 border-t border-white/[0.07] w-full flex justify-center gap-2">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span
                className={`w-[18px] h-[18px] rounded-full border font-mono-ibm text-[9.5px] font-semibold flex items-center justify-center ${
                  s.n === 1 ? 'bg-accent text-canvas border-accent' : 'bg-transparent text-white/40 border-white/[0.14]'
                }`}
              >
                {s.n}
              </span>
              <span className={`text-[11px] font-medium ${s.n === 1 ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
