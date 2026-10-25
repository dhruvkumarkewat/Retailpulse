import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Toast() {
  const { toastMsg } = useSettings();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
            className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-[#0f2419]/95 px-4 py-2.5 text-[0.8rem] font-medium text-emerald-200 shadow-2xl backdrop-blur">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="max-w-md">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
