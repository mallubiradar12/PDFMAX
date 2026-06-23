import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warn: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message: string, duration?: number) => showToast(message, 'error', duration), [showToast]);
  const warn = useCallback((message: string, duration?: number) => showToast(message, 'warning', duration), [showToast]);
  const info = useCallback((message: string, duration?: number) => showToast(message, 'info', duration), [showToast]);

  // Map types to rich styles and icons
  const getToastStyle = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />,
          bgColor: 'bg-slate-900/95 border-emerald-500/30',
          progressBarColor: 'bg-emerald-500',
          textColor: 'text-slate-100',
          glow: 'shadow-[0_4px_20px_0_rgba(16,185,129,0.12)]',
        };
      case 'error':
        return {
          icon: <XCircle size={16} className="text-red-400 flex-shrink-0" />,
          bgColor: 'bg-slate-900/95 border-red-500/30',
          progressBarColor: 'bg-red-500',
          textColor: 'text-slate-100',
          glow: 'shadow-[0_4px_20px_0_rgba(239,68,68,0.12)]',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />,
          bgColor: 'bg-slate-900/95 border-amber-500/30',
          progressBarColor: 'bg-amber-500',
          textColor: 'text-slate-100',
          glow: 'shadow-[0_4px_20px_0_rgba(245,158,11,0.12)]',
        };
      case 'info':
      default:
        return {
          icon: <Info size={16} className="text-indigo-400 flex-shrink-0" />,
          bgColor: 'bg-slate-900/95 border-indigo-500/30',
          progressBarColor: 'bg-indigo-505',
          textColor: 'text-slate-100',
          glow: 'shadow-[0_4px_20px_0_rgba(99,102,241,0.12)]',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warn, info }}>
      {children}
      
      {/* Toast Notifications Container in Top-Right Stack */}
      <div className="fixed top-6 right-6 z-55 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const style = getToastStyle(toast.type);
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`pointer-events-auto w-full flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md ${style.bgColor} ${style.glow} hover:border-slate-700/60 transition-colors select-none`}
              >
                {style.icon}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-relaxed ${style.textColor} whitespace-pre-wrap text-left`}>
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-350 hover:bg-slate-800/60 transition-colors flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
