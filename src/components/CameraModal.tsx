import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Translations } from '../i18n/translations';

interface CameraModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
}

export function CameraModal({ t, open, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    const startCamera = async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.dialogs.cameraUnavailable);
        return;
      }
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          activeStream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? `${t.dialogs.cameraUnavailable} (${err.message})`
            : t.dialogs.cameraUnavailable,
        );
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, [open, t.dialogs.cameraUnavailable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={t.dialogs.cameraTitle}
    >
      <div className="m3-surface-high w-full max-w-lg overflow-hidden rounded-[28px] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-base font-bold">
            <Camera className="h-5 w-5 m3-text-primary" aria-hidden="true" />
            <span>{t.dialogs.cameraTitle}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.dialogs.cancel}
            className="m3-surface-highest flex h-9 w-9 cursor-pointer items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {error ? (
            <div className="m3-error-container rounded-[20px] p-5 text-sm">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-[20px] bg-black object-cover"
            />
          )}
        </div>
      </div>
    </div>
  );
}
