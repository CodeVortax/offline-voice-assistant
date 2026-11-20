interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmTone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="m3-surface-high w-full max-w-md rounded-[28px] p-6 shadow-2xl">
        <h3 id="confirm-dialog-title" className="text-xl font-bold">
          {title}
        </h3>
        <p className="m3-text-muted mt-3 whitespace-pre-line text-sm leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="m3-text-primary min-h-[40px] cursor-pointer rounded-full px-5 text-sm font-semibold hover:opacity-80"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[40px] cursor-pointer rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90 ${
              confirmTone === 'danger' ? 'm3-error-container' : 'm3-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
