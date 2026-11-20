import { X } from 'lucide-react';
import { ToastMessage } from '../types/assistant';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-20 left-4 z-50 flex flex-col items-center gap-2 sm:left-auto sm:right-6 sm:w-96 lg:bottom-24"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          dir="auto"
          className={`pointer-events-auto flex w-full items-center justify-between gap-3 rounded-[16px] px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === 'error' ? 'm3-error-container' : 'm3-inverse-surface'
          }`}
        >
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 cursor-pointer rounded-full p-1 opacity-75 hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
