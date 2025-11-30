import React from 'react';
import { ShieldCheck, User, Server } from 'lucide-react';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4 border border-slate-700 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Smart<span className="text-indigo-500">Park</span> Monitor</h1>
          <p className="text-slate-400">Select your access level to continue</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onLogin(UserRole.ADMIN)}
            className="group w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-indigo-900/20"
          >
            <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
              <Server className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-semibold group-hover:text-indigo-300 transition-colors">Server Account</h3>
              <p className="text-xs text-slate-500">Full access to edit maps, simulate, and manage layouts.</p>
            </div>
          </button>

          <button
            onClick={() => onLogin(UserRole.GUEST)}
            className="group w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-emerald-900/20"
          >
            <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-semibold group-hover:text-emerald-300 transition-colors">Guest Account</h3>
              <p className="text-xs text-slate-500">Read-only access to view map and parking status.</p>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center">
            <p className="text-xs text-slate-600">Smart Park System v2.1 • Authorized Access Only</p>
        </div>
      </div>
    </div>
  );
};