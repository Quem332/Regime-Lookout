import React, { useEffect } from "react";

export function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur p-4 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white/90 truncate">{title}</div>
          <button
            className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
