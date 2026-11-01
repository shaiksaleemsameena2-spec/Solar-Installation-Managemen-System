import { X, Sparkles, MessageSquare } from "lucide-react";

interface Props {
  onOpenChat: () => void;
  onDismiss: () => void;
}

export function SolarBotSpeechBubble({ onOpenChat, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="relative mb-2 w-72 sm:w-80 rounded-2xl border border-emerald-500/30 bg-slate-950/92 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
    >
      {/* Speech Bubble Arrow pointing to the robot */}
      <div className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-r border-b border-emerald-500/30 bg-slate-950/92" />

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome message"
        className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <span>May I help you? ☀️</span>
        </h4>
      </div>

      {/* Body text */}
      <p className="mt-2 text-[12.5px] leading-relaxed text-slate-200">
        I'm <strong className="text-emerald-400 font-semibold">SolarBot</strong>, your personal solar assistant. Ask me anything about solar panels, pricing, installation, savings, or maintenance!
      </p>

      {/* Action CTA */}
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
        <span className="text-[10.5px] text-slate-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" /> Powered by SunPower
        </span>
        <button
          type="button"
          onClick={onOpenChat}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95 cursor-pointer"
        >
          <MessageSquare className="h-3 w-3" />
          Chat with me
        </button>
      </div>
    </div>
  );
}

