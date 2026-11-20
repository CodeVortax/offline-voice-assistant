import { NotificationPayload, NotificationRecord } from '../types/assistant';
import { TTSService } from './ttsService';

const STORAGE_KEY_ENABLED = 'NotificationReaderPrefs.notification_reading_enabled';
const SELF_PACKAGE_NAME = 'me2008.assistant';
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

export interface NotificationReaderCallback {
  onNotificationRead: (record: NotificationRecord) => void;
  onNotificationSkipped?: (reason: string) => void;
}

/**
 * Port of NotificationReaderService.java.
 * Preserves localStorage persistence, self/system package filtering, 5-minute TTL
 * duplicate prevention (max 100 entries), message formatting, and TTS speech output.
 *
 * TODO: Web browsers cannot intercept notifications posted by other OS applications
 * (Android's NotificationListenerService). Incoming notifications in web mode are
 * triggered via in-app events or simulated notifications for verification.
 */
export class NotificationReaderService {
  private ttsService: TTSService;
  private callback: NotificationReaderCallback | null = null;
  private readNotifications = new Map<string, number>();

  constructor(ttsService: TTSService) {
    this.ttsService = ttsService;
  }

  public setCallback(callback: NotificationReaderCallback): void {
    this.callback = callback;
  }

  public isEnabled(): boolean {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_ENABLED);
      if (stored === null) {
        return true; // Matches MainActivity.java default: true
      }
      return stored === 'true';
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    } catch {
      // Ignore storage quota errors
    }
  }

  public isNotificationAccessGranted(): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    return window.Notification.permission === 'granted';
  }

  public async requestNotificationAccess(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      return await window.Notification.requestPermission();
    } catch {
      return window.Notification.permission;
    }
  }

  public onNotificationPosted(payload: NotificationPayload): boolean {
    if (!this.isEnabled()) {
      this.callback?.onNotificationSkipped?.('Notification reading is disabled');
      return false;
    }

    const packageName = payload.packageName.trim();
    // Skip system and self notifications (NotificationReaderService.java lines 85-89)
    if (
      packageName === SELF_PACKAGE_NAME ||
      packageName.toLowerCase().includes('android') ||
      packageName.toLowerCase().includes('system')
    ) {
      this.callback?.onNotificationSkipped?.(`Filtered system/self package: ${packageName}`);
      return false;
    }

    const appName = payload.appName?.trim() || this.resolveAppName(packageName);
    const title = payload.title.trim();
    const text = payload.text.trim();
    const subText = payload.subText?.trim() ?? '';
    const postTime = payload.postTime ?? Date.now();

    // Unique notification key for duplicate prevention (same content within 5 minutes)
    const notificationKey = `${packageName}_${title}_${text}`;
    const now = Date.now();
    this.pruneExpiredEntries(now);

    if (this.readNotifications.has(notificationKey)) {
      this.callback?.onNotificationSkipped?.(`Duplicate notification skipped (${appName})`);
      return false;
    }

    this.readNotifications.set(notificationKey, now);
    if (this.readNotifications.size > MAX_CACHE_SIZE) {
      const oldestKey = this.readNotifications.keys().next().value;
      if (oldestKey) {
        this.readNotifications.delete(oldestKey);
      }
    }

    // Build spoken message matching NotificationReaderService.java lines 126-144
    const parts: string[] = [];
    if (appName) {
      parts.push(`${appName} notification`);
    }
    if (title && title !== appName) {
      parts.push(`from ${title}`);
    }
    let finalMessage = parts.join(' ');
    if (text) {
      finalMessage += `: ${text}`;
    } else if (subText) {
      finalMessage += `: ${subText}`;
    }

    finalMessage = finalMessage.trim();
    if (!finalMessage) {
      return false;
    }

    this.ttsService.speak(finalMessage);

    const record: NotificationRecord = {
      id: `${postTime}_${Math.random().toString(36).slice(2, 7)}`,
      packageName,
      appName,
      title,
      text: text || subText,
      formattedMessage: finalMessage,
      timestamp: new Date(postTime).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    };

    this.callback?.onNotificationRead(record);
    return true;
  }

  private resolveAppName(packageName: string): string {
    const lastSegment = packageName.slice(packageName.lastIndexOf('.') + 1);
    return lastSegment ? lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1) : packageName;
  }

  private pruneExpiredEntries(now: number): void {
    for (const [key, timestamp] of this.readNotifications.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        this.readNotifications.delete(key);
      }
    }
  }

  public clearCache(): void {
    this.readNotifications.clear();
  }
}
