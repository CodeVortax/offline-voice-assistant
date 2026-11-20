import {
  ActionLink,
  AppActionDispatch,
  AppCapabilityKind,
  DeviceState,
  MaterialYouSeed,
  MessageDraft,
  ThemeMode,
} from '../types/assistant';
import { formatTime12h } from './arabicNlu';
import {
  AutomationService,
  buildAndroidAlarmIntentUri,
  buildAndroidSettingsIntentUri,
  buildAndroidTimerIntentUri,
} from './automationService';
import { WebSearchHelper } from './webSearchHelper';

export interface CommandExecutorHost {
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  onActionLink: (link: ActionLink | null) => void;
  onMessageDraft: (draft: MessageDraft | null) => void;
  onAppDispatch: (dispatch: AppActionDispatch | null) => void;
  onDeviceStatePatch: (patch: Partial<DeviceState>) => void;
  onVolumeChange: (volume: number, muted: boolean) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onThemeSeedChange: (seed: MaterialYouSeed) => void;
  onOpenCamera: () => void;
  onSetNotificationsEnabled?: (enabled: boolean) => void;
}

interface AppWebMapping {
  name: string;
  url: string;
  description: string;
}

const PACKAGE_TO_WEB_APP: Record<string, AppWebMapping> = {
  'com.whatsapp': {
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    description: 'Launch WhatsApp Web in a new tab',
  },
  'com.google.android.youtube': {
    name: 'YouTube',
    url: 'https://www.youtube.com',
    description: 'Open YouTube in a new tab',
  },
  'com.android.chrome': {
    name: 'Chrome',
    url: 'https://www.google.com',
    description: 'Open Google in your browser',
  },
  'com.instagram.android': {
    name: 'Instagram',
    url: 'https://www.instagram.com',
    description: 'Launch Instagram in a new tab',
  },
  'com.google.android.gm': {
    name: 'Gmail',
    url: 'https://mail.google.com',
    description: 'Open Gmail inbox in a new tab',
  },
  'com.google.android.apps.maps': {
    name: 'Google Maps',
    url: 'https://maps.google.com',
    description: 'Open Google Maps for navigation',
  },
  'com.spotify.music': {
    name: 'Spotify',
    url: 'https://open.spotify.com',
    description: 'Open Spotify Web Player',
  },
  'com.google.android.apps.youtube.music': {
    name: 'YouTube Music',
    url: 'https://music.youtube.com',
    description: 'Open YouTube Music',
  },
  'com.google.android.calculator': {
    name: 'Calculator',
    url: 'https://www.google.com/search?q=calculator',
    description: 'Open web calculator',
  },
  'com.google.android.deskclock': {
    name: 'Clock',
    url: 'intent:#Intent;action=android.intent.action.SHOW_ALARMS;end',
    description: 'Launch Android Clock App via Intent API',
  },
  'com.google.android.calendar': {
    name: 'Calendar',
    url: 'https://calendar.google.com',
    description: 'Open Google Calendar',
  },
};

export class CommandExecutor {
  private host: CommandExecutorHost;
  private webSearchHelper: WebSearchHelper;
  private automationService: AutomationService;
  private isFlashlightOn = false;
  private volume = 80;
  private muted = false;
  private brightness = 75;
  private torchStream: MediaStream | null = null;

  constructor(
    host: CommandExecutorHost,
    webSearchHelper: WebSearchHelper,
    automationService: AutomationService,
  ) {
    this.host = host;
    this.webSearchHelper = webSearchHelper;
    this.automationService = automationService;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getBrightness(): number {
    return this.brightness;
  }

  public clearTransientCards(): void {
    this.host.onMessageDraft(null);
    this.host.onAppDispatch(null);
  }

  // ---- Generic Internal App Action API Dispatcher (Clock, Crystal, Imported JSON Plugins) ----
  public async dispatchToAppApi(
    appId: string,
    capability: AppCapabilityKind,
    payload: Record<string, unknown>,
    options?: {
      actionId?: string;
      summary?: string;
      overrideUri?: string;
    },
  ): Promise<AppActionDispatch | null> {
    this.clearTransientCards();
    const dispatch = await this.automationService.dispatchAppAction(
      appId,
      capability,
      payload,
      options,
    );
    if (!dispatch) return null;

    this.host.onDeviceStatePatch({ lastOpenedApp: dispatch.appName });
    this.host.onAppDispatch(dispatch);

    if (dispatch.uri) {
      this.host.onActionLink({
        label: dispatch.appName,
        url: dispatch.uri,
        description: dispatch.summary,
      });
    } else {
      this.host.onActionLink(null);
    }

    return dispatch;
  }

  // ---- Google Assistant-style Clock App Delegation (NO local timer widget) ----
  public async dispatchClockAlarm(
    time24: string,
    label: string,
  ): Promise<{ formatted12h: string; intentUri: string }> {
    const [hStr, mStr] = time24.split(':');
    const hour = Number(hStr) || 7;
    const minute = Number(mStr) || 0;
    const formatted12h = formatTime12h(time24);
    const intentUri = buildAndroidAlarmIntentUri(time24, label);

    await this.dispatchToAppApi(
      'clock-api',
      'set_alarm',
      { time24, hour, minute, text: label },
      {
        actionId: 'clock_set_alarm',
        summary: `Clock SET_ALARM → ${formatted12h} (${label})`,
        overrideUri: intentUri,
      },
    );

    return { formatted12h, intentUri };
  }

  public async dispatchClockTimer(
    durationSec: number,
    label: string,
  ): Promise<{ intentUri: string }> {
    const safeSec = Math.max(5, Math.round(durationSec));
    const minutes = Math.round((safeSec / 60) * 10) / 10;
    const intentUri = buildAndroidTimerIntentUri(safeSec, label);

    await this.dispatchToAppApi(
      'clock-api',
      'set_timer',
      { seconds: safeSec, minutes, text: label },
      {
        actionId: 'clock_set_timer',
        summary: `Clock SET_TIMER → ${label} (${safeSec}s)`,
        overrideUri: intentUri,
      },
    );

    return { intentUri };
  }

  // ---- Google Assistant-style Device Settings Controls ----
  public setDeviceToggle(
    setting: 'wifi' | 'bluetooth' | 'dnd' | 'airplane' | 'battery_saver',
    turnOn: boolean,
  ): boolean {
    const stateMap: Record<typeof setting, Partial<DeviceState>> = {
      wifi: { wifiOn: turnOn },
      bluetooth: { bluetoothOn: turnOn },
      dnd: { dndOn: turnOn },
      airplane: { airplaneModeOn: turnOn, ...(turnOn ? { wifiOn: false, bluetoothOn: false } : {}) },
      battery_saver: { batterySaverOn: turnOn },
    };
    const labelMap: Record<typeof setting, string> = {
      wifi: 'Wi-Fi',
      bluetooth: 'Bluetooth',
      dnd: 'Do Not Disturb',
      airplane: 'Airplane Mode',
      battery_saver: 'Battery Saver',
    };

    this.host.onDeviceStatePatch(stateMap[setting]);
    const intentUri = buildAndroidSettingsIntentUri(setting);
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting, value: turnOn ? 'on' : 'off' },
      {
        actionId: 'device_toggle_setting',
        summary: `${labelMap[setting]} → ${turnOn ? 'ON' : 'OFF'}`,
        overrideUri: intentUri,
      },
    );
    return true;
  }

  public setBrightnessLevel(percent: number): boolean {
    this.brightness = Math.max(10, Math.min(100, Math.round(percent)));
    this.host.onDeviceStatePatch({ brightness: this.brightness });
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'brightness', value: this.brightness },
      {
        actionId: 'device_toggle_setting',
        summary: `Display Brightness → ${this.brightness}%`,
        overrideUri: buildAndroidSettingsIntentUri('brightness'),
      },
    );
    return true;
  }

  public adjustBrightness(increase: boolean): boolean {
    return this.setBrightnessLevel(this.brightness + (increase ? 15 : -15));
  }

  public setVolumeLevel(percent: number): boolean {
    this.volume = Math.max(0, Math.min(100, Math.round(percent)));
    this.muted = this.volume === 0;
    this.host.onVolumeChange(this.volume, this.muted);
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'volume', value: this.volume, muted: this.muted },
      {
        actionId: 'device_toggle_setting',
        summary: `Volume → ${this.muted ? 'Muted' : `${this.volume}%`}`,
        overrideUri: buildAndroidSettingsIntentUri('volume'),
      },
    );
    return true;
  }

  public adjustVolume(increase: boolean): boolean {
    return this.setVolumeLevel(this.volume + (increase ? 15 : -15));
  }

  public muteVolume(): boolean {
    this.muted = true;
    this.host.onVolumeChange(this.volume, true);
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'volume', value: 0, muted: true },
      {
        actionId: 'device_toggle_setting',
        summary: 'Volume → Muted',
        overrideUri: buildAndroidSettingsIntentUri('volume'),
      },
    );
    return true;
  }

  public setDarkMode(dark: boolean): boolean {
    this.host.onThemeModeChange(dark ? 'dark' : 'light');
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'dark_mode', value: dark ? 'dark' : 'light' },
      {
        actionId: 'device_toggle_setting',
        summary: `Appearance → ${dark ? 'Material You Dark' : 'Material You Light'}`,
        overrideUri: buildAndroidSettingsIntentUri('dark_mode'),
      },
    );
    return true;
  }

  public setThemeSeed(seed: MaterialYouSeed): boolean {
    this.host.onThemeSeedChange(seed);
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'theme_seed', value: seed },
      {
        actionId: 'device_toggle_setting',
        summary: `Material You Palette → ${seed}`,
      },
    );
    return true;
  }

  public toggleFlashlight(turnOn: boolean): boolean {
    this.isFlashlightOn = turnOn;
    this.host.onDeviceStatePatch({ flashlightOn: turnOn });
    void this.dispatchToAppApi(
      'settings-api',
      'device_setting',
      { setting: 'flashlight', value: turnOn ? 'on' : 'off' },
      {
        actionId: 'device_toggle_setting',
        summary: `Flashlight → ${turnOn ? 'ON' : 'OFF'}`,
      },
    );
    void this.tryApplyHardwareTorch(turnOn);
    return true;
  }

  private async tryApplyHardwareTorch(turnOn: boolean): Promise<void> {
    try {
      if (!turnOn) {
        if (this.torchStream) {
          this.torchStream.getTracks().forEach((track) => track.stop());
          this.torchStream = null;
        }
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        if (capabilities?.torch) {
          await track.applyConstraints({
            advanced: [{ torch: true } as MediaTrackConstraintSet],
          });
          this.torchStream = stream;
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      }
    } catch {
      // Hardware torch unavailable; UI control state remains active
    }
  }

  // ---- App Launching, Messaging & Navigation ----
  public openApp(packageName: string): boolean {
    this.clearTransientCards();
    if (packageName === 'app.crystal') {
      void this.dispatchToAppApi(
        'crystal-api',
        'custom_action',
        { text: 'open' },
        { actionId: 'crystal_custom_action', summary: 'Launch Crystal App' },
      );
      return true;
    }

    const app = PACKAGE_TO_WEB_APP[packageName];
    if (!app) {
      this.host.onToast(`App not installed: ${packageName}`, 'error');
      return false;
    }

    this.host.onDeviceStatePatch({ lastOpenedApp: app.name });
    this.host.onActionLink({
      label: `Open ${app.name}`,
      url: app.url,
      description: app.description,
    });
    return true;
  }

  public prepareAndSendMessage(
    recipientInput: string,
    messageText: string,
    channel: 'whatsapp' | 'sms' | 'email' = 'whatsapp',
  ): MessageDraft {
    this.host.onAppDispatch(null);
    const draft = this.automationService.buildMessageDraft(
      recipientInput,
      messageText,
      channel,
    );
    this.host.onDeviceStatePatch({
      lastOpenedApp: channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'SMS',
    });
    this.host.onMessageDraft(draft);
    this.host.onActionLink({
      label: `${channel.toUpperCase()} · ${draft.recipientName}`,
      url: draft.actionUrl,
      description: `"${draft.message}" (${draft.phone})`,
      secondaryLabel: draft.smsFallbackUrl ? 'SMS' : undefined,
      secondaryUrl: draft.smsFallbackUrl,
    });
    void this.automationService.dispatchAppAction(
      'messaging-api',
      'send_message',
      { recipient: draft.recipientName, phone: draft.phone, channel, text: draft.message },
      {
        actionId: 'messaging_send',
        summary: `${channel.toUpperCase()} → ${draft.recipientName}`,
        overrideUri: draft.actionUrl,
      },
    );
    return draft;
  }

  public navigateTo(destination: string): boolean {
    this.clearTransientCards();
    const clean = destination.trim();
    if (!clean) return this.openApp('com.google.android.apps.maps');
    this.host.onDeviceStatePatch({ lastOpenedApp: 'Google Maps' });
    this.host.onActionLink({
      label: `Navigate to ${clean}`,
      url: this.webSearchHelper.buildMapsUrl(clean),
      description: 'Open turn-by-turn directions in Google Maps',
    });
    return true;
  }

  public openCamera(): boolean {
    this.clearTransientCards();
    this.host.onDeviceStatePatch({ lastOpenedApp: 'Camera' });
    this.host.onOpenCamera();
    return true;
  }

  public makeCall(contactName: string): boolean {
    this.clearTransientCards();
    const contact = this.automationService.findContact(contactName);
    const displayName = contact?.name ?? (contactName.trim() || 'Contact');
    const phoneDigits = (contact?.phone ?? contactName).replace(/[^0-9+]/g, '');
    this.host.onDeviceStatePatch({ lastOpenedApp: `Dialer (${displayName})` });
    this.host.onActionLink({
      label: `Call ${displayName}${phoneDigits ? ` (${phoneDigits})` : ''}`,
      url: phoneDigits ? `tel:${phoneDigits}` : 'tel:',
      description: 'Launches phone dialer via tel: API',
    });
    return true;
  }

  public searchOnGoogle(query: string): boolean {
    const trimmed = query.trim();
    if (!trimmed) return false;
    this.host.onDeviceStatePatch({ lastOpenedApp: 'Google Search' });
    this.host.onActionLink({
      label: `Google Search: "${trimmed}"`,
      url: this.webSearchHelper.buildGoogleSearchUrl(trimmed),
      description: 'Open full Google search results in a new tab',
    });
    return true;
  }

  public openYouTubeWithSearch(query: string): boolean {
    this.clearTransientCards();
    const trimmed = query.trim();
    if (!trimmed) return this.openApp('com.google.android.youtube');
    this.host.onDeviceStatePatch({ lastOpenedApp: 'YouTube Search' });
    this.host.onActionLink({
      label: `YouTube Search: "${trimmed}"`,
      url: this.webSearchHelper.buildYouTubeSearchUrl(trimmed),
      description: 'Open matching videos on YouTube in a new tab',
    });
    return true;
  }

  public openSettings(): boolean {
    this.host.onDeviceStatePatch({ lastOpenedApp: 'Settings' });
    this.host.onActionLink({
      label: 'Open Android Settings',
      url: buildAndroidSettingsIntentUri('settings'),
      description: 'Launches system Settings on Android (or use Quick Settings tab)',
    });
    return true;
  }

  public setNotificationsEnabled(enabled: boolean): void {
    this.host.onSetNotificationsEnabled?.(enabled);
  }

  public cleanup(): void {
    if (this.isFlashlightOn) {
      this.isFlashlightOn = false;
    }
    if (this.torchStream) {
      this.torchStream.getTracks().forEach((track) => track.stop());
      this.torchStream = null;
    }
  }
}
