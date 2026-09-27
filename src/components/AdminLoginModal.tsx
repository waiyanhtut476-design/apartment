import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Key,
  X,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Building2
} from 'lucide-react';
import { AdminUser } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (admin: AdminUser) => void;
  designatedEmail?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  designatedEmail = 'waiyanhtut476@gmail.com',
}) => {
  const [email, setEmail] = useState(designatedEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleStandardLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Check if email matches designated landlord admin or general admin
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setError('အီးမေးလ် ထည့်သွင်းပေးပါရန်');
        setIsLoading(false);
        return;
      }

      // If user inputs designated email or standard landlord pin/password
      const adminData: AdminUser = {
        email: cleanEmail,
        name: cleanEmail === designatedEmail.toLowerCase() ? 'အိမ်ရှင် (Landlord Admin)' : 'Administrator',
        role: 'admin',
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
      };

      onLoginSuccess(adminData);
      setIsLoading(false);
      onClose();
    }, 400);
  };

  const handleQuickAdminLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const adminData: AdminUser = {
        email: designatedEmail,
        name: 'အိမ်ရှင် (Landlord Admin)',
        role: 'admin',
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
      };
      onLoginSuccess(adminData);
      setIsLoading(false);
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                အိမ်ရှင် (Admin) Login ဝင်ရန်
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Landlord Authentication Access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-3 bg-amber-50/90 border-b border-amber-200/70 text-amber-900 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            အခန်းအချက်အလက်များနှင့် ကျသင့်ငွေစာရင်းများကို <strong>အိမ်ရှင် (Admin) တစ်ဦးတည်းသာ</strong> ပြင်ဆင်ခွင့်ရှိပါသည်။
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick 1-Click Login for Landlord */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-900">သတ်မှတ်ထားသော အိမ်ရှင် အကောင့်:</span>
              <span className="px-2 py-0.5 rounded bg-indigo-200/70 text-indigo-900 font-mono font-bold text-[11px]">
                Owner
              </span>
            </div>
            <div className="text-xs font-mono font-medium text-slate-700 truncate">
              {designatedEmail}
            </div>
            <button
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>အိမ်ရှင်အဖြစ် တိုက်ရိုက် Login ဝင်မည် (One-Click)</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-xs text-slate-400 font-medium">သို့မဟုတ် Password ဖြင့်</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleStandardLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                အိမ်ရှင် အီးမေးလ် (Admin Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@skyline.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                စကားဝှက် / Admin PIN (Password)
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                (သရုပ်ပြအဖြစ် မည်သည့် Password ဖြင့်မဆို Login ဝင်နိုင်ပါသည်)
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Login အတည်ပြုမည်</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Skyline Residence Security Gate</span>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            မလုပ်တော့ပါ (Cancel)
          </button>
        </div>
      </div>
    </div>
  );
};
