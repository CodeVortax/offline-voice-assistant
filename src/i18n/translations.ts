import { UiLanguage, UiLanguagePreference } from '../types/assistant';

export function detectSystemLanguage(): UiLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);

  for (const locale of candidates) {
    if (locale.toLowerCase().startsWith('ar')) {
      return 'ar';
    }
  }
  return 'en';
}

export function resolveUiLanguage(pref: UiLanguagePreference): UiLanguage {
  if (pref === 'system') return detectSystemLanguage();
  return pref;
}

export interface Translations {
  brand: {
    name: string;
    subtitle: string;
    version: string;
    licenseShort: string;
    licenseFull: string;
  };
  nav: {
    assistant: string;
    apis: string;
    activity: string;
    settings: string;
  };
  header: {
    assistant: string;
    apis: string;
    activity: string;
    settings: string;
    switchToDark: string;
    switchToLight: string;
    paletteLabel: string;
  };
  assistant: {
    awakeStatus: string;
    listeningStatus: string;
    readyStatus: string;
    loadingStatus: string;
    defaultGreeting: string;
    listen: string;
    stop: string;
    send: string;
    inputPlaceholder: string;
    multilingualHint: string;
    messageReady: string;
    sendVia: string;
    smsFallback: string;
    openIn: string;
    open: string;
    quickCommandsTitle: string;
    quickCommandsSubtitle: string;
    quickTogglesTitle: string;
    volLabel: string;
    brightLabel: string;
    muted: string;
    on: string;
    off: string;
    micLangLabel: string;
    aiModeLabel: string;
    fastOffline: string;
    smartAi: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageSectionTitle: string;
    languageSectionDesc: string;
    systemDefault: string;
    arabicLang: string;
    englishLang: string;
    currentSystemDetected: string;
    voiceSectionTitle: string;
    voiceSectionDesc: string;
    speechMicLang: string;
    intelligenceMode: string;
    offlineDesc: string;
    smartAiReadyDesc: string;
    smartAiMissingKeyDesc: string;
    appearanceTitle: string;
    appearanceDesc: string;
    lightMode: string;
    darkMode: string;
    paletteLavender: string;
    paletteSage: string;
    paletteTerracotta: string;
    paletteOcean: string;
    deviceControlsTitle: string;
    deviceControlsDesc: string;
    openCamera: string;
    brightness: string;
    volume: string;
    mute: string;
    unmute: string;
    wifi: string;
    wifiOn: string;
    bluetooth: string;
    bluetoothOn: string;
    dnd: string;
    dndOn: string;
    flashlight: string;
    flashlightOn: string;
    batterySaver: string;
    batterySaverOn: string;
    airplane: string;
    airplaneOn: string;
    autoAnswerTitle: string;
    autoAnswerDesc: string;
    testCall: string;
    testSms: string;
    incomingCall: string;
    autoAnsweringIn: string;
    answerNow: string;
    endCall: string;
    notifTitle: string;
    notifDesc: string;
    simulateNotif: string;
    testDedup: string;
    grantPermission: string;
  };
  apis: {
    title: string;
    subtitle: string;
    tabInstalled: string;
    tabImportAi: string;
    tabSandbox: string;
    tabRecords: string;
    tabRoutines: string;
    installedCount: string;
    actionsCount: string;
    internalBadge: string;
    exportJson: string;
    copyJson: string;
    testAction: string;
    deletePlugin: string;
    webhookPlaceholder: string;
    uriPlaceholder: string;
    triggersLabel: string;
    aiGenTitle: string;
    aiGenDesc: string;
    aiPromptPlaceholder: string;
    generateBtn: string;
    generatingBtn: string;
    copyAiPromptBtn: string;
    copiedPromptToast: string;
    presetGalleryTitle: string;
    presetGalleryDesc: string;
    loadPreset: string;
    jsonEditorTitle: string;
    jsonEditorDesc: string;
    uploadJsonFile: string;
    validateAndImport: string;
    validSchema: string;
    invalidSchema: string;
    warningsLabel: string;
    sandboxTitle: string;
    sandboxDesc: string;
    selectPlugin: string;
    selectAction: string;
    paramTextLabel: string;
    paramMinutesLabel: string;
    runDispatchBtn: string;
    dispatchFeedTitle: string;
    clearFeed: string;
    noDispatches: string;
    launchUri: string;
    recordsTitle: string;
    recordsDesc: string;
    saveRecordBtn: string;
    recordPlaceholder: string;
    noRecords: string;
    routinesTitle: string;
    runRoutine: string;
    createRoutineTitle: string;
    routineNamePlaceholder: string;
    routineStepsPlaceholder: string;
    addRoutineBtn: string;
  };
  activity: {
    contactsTitle: string;
    contactsDesc: string;
    contactNamePlaceholder: string;
    contactAltNamePlaceholder: string;
    contactPhonePlaceholder: string;
    addContactBtn: string;
    messageBtn: string;
    logsTitle: string;
    logsCount: string;
    clearBtn: string;
    exportBtn: string;
    noLogs: string;
  };
  overlay: {
    dockLabel: string;
    thinking: string;
    listening: string;
    placeholder: string;
    sendNow: string;
    smsFallback: string;
    open: string;
  };
  dialogs: {
    clearLogsTitle: string;
    clearLogsMsg: string;
    clearConfirm: string;
    cancel: string;
    voiceErrorTitle: string;
    retry: string;
    cameraTitle: string;
    cameraUnavailable: string;
  };
}

export const TRANSLATIONS: Record<UiLanguage, Translations> = {
  en: {
    brand: {
      name: 'Vicky AI',
      subtitle: 'Voice Assistant & Plugin Engine',
      version: 'Vicky AI v2.2',
      licenseShort: 'GNU AGPL-3.0',
      licenseFull: 'Licensed under GNU AGPL-3.0',
    },
    nav: {
      assistant: 'Assistant',
      apis: 'App APIs',
      activity: 'Activity',
      settings: 'Settings',
    },
    header: {
      assistant: 'Voice Assistant',
      apis: 'Internal App APIs & JSON Plugins',
      activity: 'Contacts & Activity Log',
      settings: 'Settings & Device Controls',
      switchToDark: 'Switch to dark mode',
      switchToLight: 'Switch to light mode',
      paletteLabel: 'Material You palette',
    },
    assistant: {
      awakeStatus: 'Awake — listening for your command',
      listeningStatus: 'Listening for "Hey Vicky" or "يا فيكي"',
      readyStatus: 'Ready · Say "Hey Vicky" · Ctrl+Space',
      loadingStatus: 'Initializing voice engine...',
      defaultGreeting: 'How can I help you today?',
      listen: 'Listen',
      stop: 'Stop',
      send: 'Send',
      inputPlaceholder: 'Type or speak a command in any language...',
      multilingualHint: 'Commands work in English, Arabic, and Hindi regardless of UI language',
      messageReady: 'Message Ready',
      sendVia: 'Send via',
      smsFallback: 'SMS Fallback',
      openIn: 'Open in',
      open: 'Open',
      quickCommandsTitle: 'Quick Commands',
      quickCommandsSubtitle: 'Tap any phrase to test instantly or speak it aloud',
      quickTogglesTitle: 'Quick Controls',
      volLabel: 'Vol',
      brightLabel: 'Bright',
      muted: 'Muted',
      on: 'On',
      off: 'Off',
      micLangLabel: 'Mic Language',
      aiModeLabel: 'Intelligence',
      fastOffline: 'Fast Offline',
      smartAi: 'Smart AI',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure interface language, Material You appearance, speech engine, and live device controls',
      languageSectionTitle: 'Interface Language',
      languageSectionDesc: 'The entire UI displays in one consistent language. Voice and typed commands always accept any language.',
      systemDefault: 'System Default',
      arabicLang: 'العربية',
      englishLang: 'English',
      currentSystemDetected: 'System detected',
      voiceSectionTitle: 'Voice & Small Intelligence',
      voiceSectionDesc: 'Select microphone recognition dialect and toggle optional cloud reasoning',
      speechMicLang: 'Speech Recognition Language',
      intelligenceMode: 'Intelligence Engine',
      offlineDesc: 'Instant offline math, device settings, internal plugins & Wikipedia',
      smartAiReadyDesc: 'Local engine + Gemini Flash-Lite cloud reasoning active',
      smartAiMissingKeyDesc: 'Add GEMINI_API_KEY in Settings > Secrets to enable cloud replies',
      appearanceTitle: 'Material You Appearance',
      appearanceDesc: 'Switch dynamic wallpaper color palettes and Light/Dark mode by touch or voice',
      lightMode: 'Light',
      darkMode: 'Dark',
      paletteLavender: 'Lavender',
      paletteSage: 'Monet Sage',
      paletteTerracotta: 'Terracotta',
      paletteOcean: 'Ocean Blue',
      deviceControlsTitle: 'Quick Device Controls',
      deviceControlsDesc: 'Google Assistant–style system toggles controllable by voice or touch',
      openCamera: 'Open Camera',
      brightness: 'Display Brightness',
      volume: 'Assistant Volume',
      mute: 'Mute',
      unmute: 'Unmute',
      wifi: 'Wi-Fi',
      wifiOn: 'Connected',
      bluetooth: 'Bluetooth',
      bluetoothOn: 'Discoverable',
      dnd: 'Do Not Disturb',
      dndOn: 'Silenced',
      flashlight: 'Flashlight',
      flashlightOn: 'Torch active',
      batterySaver: 'Battery Saver',
      batterySaverOn: 'Active',
      airplane: 'Airplane Mode',
      airplaneOn: 'Radios off',
      autoAnswerTitle: 'Auto-Answer Calls & SMS',
      autoAnswerDesc: '10s countdown · Announces caller & speaks offline AI message',
      testCall: 'Test Call',
      testSms: 'Test SMS',
      incomingCall: 'Incoming Call',
      autoAnsweringIn: 'Auto-answering in',
      answerNow: 'Answer Now',
      endCall: 'End Call',
      notifTitle: 'Smart Notification Reader',
      notifDesc: 'Filters system alerts & deduplicates repeats for 5 minutes',
      simulateNotif: 'Simulate Notification',
      testDedup: 'Test Dedup',
      grantPermission: 'Grant Permission',
    },
    apis: {
      title: 'Internal App API & Plugin Engine',
      subtitle: 'Modular JSON-driven plugins with internal handlers, Android Intents, webhooks, and AI template generation',
      tabInstalled: 'Installed Plugins',
      tabImportAi: 'AI Generator & JSON Import',
      tabSandbox: 'Live Sandbox',
      tabRecords: 'Internal Storage',
      tabRoutines: 'Routines',
      installedCount: 'plugins',
      actionsCount: 'actions',
      internalBadge: 'Internal Engine',
      exportJson: 'Export JSON',
      copyJson: 'Copy JSON',
      testAction: 'Test',
      deletePlugin: 'Delete',
      webhookPlaceholder: 'Optional Webhook URL (POST JSON)',
      uriPlaceholder: 'Deep Link / Android Intent URI template',
      triggersLabel: 'Voice triggers',
      aiGenTitle: 'Generate Plugin JSON with AI',
      aiGenDesc: 'Describe any app or automation in plain English or Arabic to generate a validated Vicky Plugin v1.0 JSON manifest',
      aiPromptPlaceholder: 'e.g. A Home Assistant plugin to turn bedroom lights on/off and set AC temperature via webhook...',
      generateBtn: 'Generate JSON Manifest',
      generatingBtn: 'Generating...',
      copyAiPromptBtn: 'Copy Prompt for Any External AI',
      copiedPromptToast: 'AI plugin prompt copied — paste it into any AI to generate an importable JSON template',
      presetGalleryTitle: 'Ready-to-Import JSON Templates',
      presetGalleryDesc: 'Load an advanced template into the editor to inspect or import immediately',
      loadPreset: 'Load JSON',
      jsonEditorTitle: 'JSON Manifest Editor & Importer',
      jsonEditorDesc: 'Paste AI-generated JSON or upload a .json manifest file — validated live against Vicky Plugin Schema v1.0',
      uploadJsonFile: 'Upload .json File',
      validateAndImport: 'Validate & Import Plugin',
      validSchema: 'Valid Vicky Plugin v1.0 manifest',
      invalidSchema: 'Validation errors found',
      warningsLabel: 'Warnings',
      sandboxTitle: 'Interactive Plugin Sandbox',
      sandboxDesc: 'Execute any installed plugin action directly and inspect the live payload, resolved URI, and webhook result',
      selectPlugin: 'Plugin',
      selectAction: 'Action',
      paramTextLabel: 'Text / Value payload',
      paramMinutesLabel: 'Minutes (optional)',
      runDispatchBtn: 'Execute Action',
      dispatchFeedTitle: 'Live API Dispatch Stream',
      clearFeed: 'Clear Feed',
      noDispatches: 'No plugin actions dispatched yet. Run a test above or trigger one by voice.',
      launchUri: 'Launch URI',
      recordsTitle: 'Internal Plugin Storage',
      recordsDesc: 'Persistent local records saved by plugins with internal execution enabled (Crystal notes, tasks, custom entries)',
      saveRecordBtn: 'Save Record',
      recordPlaceholder: 'Add a quick internal record...',
      noRecords: 'No internal plugin records yet.',
      routinesTitle: 'Multi-Step Routines',
      runRoutine: 'Run',
      createRoutineTitle: 'Create Custom Routine',
      routineNamePlaceholder: 'Routine name (e.g. Study Session)',
      routineStepsPlaceholder: 'Comma-separated commands (e.g. turn on do not disturb, set brightness to 40, mute volume)',
      addRoutineBtn: 'Add Routine',
    },
    activity: {
      contactsTitle: 'Contacts Directory',
      contactsDesc: 'Used for WhatsApp, SMS, and call commands across languages',
      contactNamePlaceholder: 'Name (e.g. Omar)',
      contactAltNamePlaceholder: 'Alternate / Arabic alias (optional)',
      contactPhonePlaceholder: '+2010...',
      addContactBtn: 'Add Contact',
      messageBtn: 'Message',
      logsTitle: 'Activity Log',
      logsCount: 'recorded events',
      clearBtn: 'Clear',
      exportBtn: 'Export .txt',
      noLogs: 'No activity recorded yet.',
    },
    overlay: {
      dockLabel: 'Hey Vicky',
      thinking: 'Thinking...',
      listening: "Hi, I'm listening...",
      placeholder: 'Ask Vicky in any language...',
      sendNow: 'Send Now',
      smsFallback: 'SMS Fallback',
      open: 'Open',
    },
    dialogs: {
      clearLogsTitle: 'Clear Activity Logs',
      clearLogsMsg: 'Are you sure you want to clear all recorded activity logs?',
      clearConfirm: 'Clear Logs',
      cancel: 'Cancel',
      voiceErrorTitle: 'Voice Engine Error',
      retry: 'Retry',
      cameraTitle: 'Camera Preview',
      cameraUnavailable: 'Camera API is not available in this browser.',
    },
  },
  ar: {
    brand: {
      name: 'فيكي الذكي',
      subtitle: 'مساعد صوتي ومحرك إضافات API',
      version: 'فيكي الذكي v2.2',
      licenseShort: 'رخصة GNU AGPL-3.0',
      licenseFull: 'مرخّص بموجب GNU AGPL-3.0',
    },
    nav: {
      assistant: 'المساعد',
      apis: 'إضافات API',
      activity: 'السجل',
      settings: 'الإعدادات',
    },
    header: {
      assistant: 'المساعد الصوتي',
      apis: 'محرك إضافات الـ API وقوالب JSON',
      activity: 'جهات الاتصال وسجل النشاط',
      settings: 'الإعدادات والتحكم بالجهاز',
      switchToDark: 'التبديل إلى الوضع الداكن',
      switchToLight: 'التبديل إلى الوضع الفاتح',
      paletteLabel: 'ألوان ماتيريال يو',
    },
    assistant: {
      awakeStatus: 'فيكي مستيقظ — تفضل بقول أمرك',
      listeningStatus: 'جاري الاستماع لكلمة "يا فيكي" أو "Hey Vicky"',
      readyStatus: 'جاهز · قل "يا فيكي" · أو اضغط Ctrl+Space',
      loadingStatus: 'جاري تهيئة محرك الصوت...',
      defaultGreeting: 'كيف أقدر أساعدك اليوم؟',
      listen: 'استمع',
      stop: 'إيقاف',
      send: 'إرسال',
      inputPlaceholder: 'اكتب أو انطق أمرك بأي لغة (عربي، إنجليزي، أو معادلات)...',
      multilingualHint: 'الأوامر الصوتية والنصية تُستقبل بأي لغة مهما كانت لغة الواجهة',
      messageReady: 'الرسالة جاهزة للإرسال',
      sendVia: 'إرسال عبر',
      smsFallback: 'إرسال عبر SMS',
      openIn: 'فتح في',
      open: 'فتح',
      quickCommandsTitle: 'أوامر سريعة',
      quickCommandsSubtitle: 'اضغط على أي أمر لتجربته فوراً أو انطقه بصوتك',
      quickTogglesTitle: 'تحكم سريع',
      volLabel: 'الصوت',
      brightLabel: 'السطوع',
      muted: 'صامت',
      on: 'مُفعّل',
      off: 'متوقف',
      micLangLabel: 'لغة الميكروفون',
      aiModeLabel: 'الذكاء',
      fastOffline: 'أوفلاين سريع',
      smartAi: 'ذكاء سحابي',
    },
    settings: {
      title: 'الإعدادات',
      subtitle: 'تخصيص لغة التطبيق، ألوان ماتيريال يو، محرك الصوت، والتحكم الكامل بإعدادات الجهاز',
      languageSectionTitle: 'لغة واجهة التطبيق',
      languageSectionDesc: 'التطبيق بالكامل يعمل بلغة واحدة موحّدة (عربي أو إنجليزي)، بينما الأوامر الصوتية والنصية تبقى متاحة بأي لغة.',
      systemDefault: 'لغة النظام الافتراضية',
      arabicLang: 'العربية',
      englishLang: 'English',
      currentSystemDetected: 'لغة النظام المكتشفة',
      voiceSectionTitle: 'محرك الصوت والذكاء السريع',
      voiceSectionDesc: 'اختر لهجة التعرف الصوتي ووضع الذكاء المحلي أو السحابي',
      speechMicLang: 'لغة التعرف الصوتي للميكروفون',
      intelligenceMode: 'وضع الذكاء',
      offlineDesc: 'حسابات فورية، تحكم بالإعدادات، إضافات API داخلية وويكيبيديا بدون إنترنت',
      smartAiReadyDesc: 'المحرك المحلي السريع + ذكاء Gemini Flash-Lite السحابي مُفعّل',
      smartAiMissingKeyDesc: 'أضف GEMINI_API_KEY في الإعدادات السرية لتفعيل الردود السحابية',
      appearanceTitle: 'مظهر ماتيريال يو الديناميكي',
      appearanceDesc: 'غيّر لوحة الألوان أو الوضع الداكن والفاتح باللمس أو بالصوت',
      lightMode: 'فاتح',
      darkMode: 'داكن',
      paletteLavender: 'لافندر',
      paletteSage: 'أخضر طبيعي',
      paletteTerracotta: 'تراكوتا دافئ',
      paletteOcean: 'أزرق محيطي',
      deviceControlsTitle: 'التحكم السريع بإعدادات الجهاز',
      deviceControlsDesc: 'أزرار تحكم بأسلوب أندرويد 15 ومساعد جوجل تعمل باللمس أو بالصوت',
      openCamera: 'فتح الكاميرا',
      brightness: 'سطوع الشاشة',
      volume: 'مستوى الصوت',
      mute: 'كتم',
      unmute: 'إلغاء الكتم',
      wifi: 'الواي فاي',
      wifiOn: 'متصل',
      bluetooth: 'البلوتوث',
      bluetoothOn: 'نشط',
      dnd: 'عدم الإزعاج',
      dndOn: 'صامت',
      flashlight: 'الكشاف',
      flashlightOn: 'مضيء',
      batterySaver: 'توفير الطاقة',
      batterySaverOn: 'مُفعّل',
      airplane: 'وضع الطيران',
      airplaneOn: 'الشبكات متوقفة',
      autoAnswerTitle: 'الرد التلقائي على المكالمات والرسائل',
      autoAnswerDesc: 'عد تنازلي 10 ثوانٍ · ينطق اسم المتصل ويرد برسالة ذكية تلقائياً',
      testCall: 'تجربة مكالمة',
      testSms: 'تجربة رسالة SMS',
      incomingCall: 'مكالمة واردة',
      autoAnsweringIn: 'الرد التلقائي خلال',
      answerNow: 'رد الآن',
      endCall: 'إنهاء المكالمة',
      notifTitle: 'قارئ الإشعارات الذكي',
      notifDesc: 'يفلتر إشعارات النظام ويمنع تكرار نفس الإشعار لمدة 5 دقائق',
      simulateNotif: 'محاكاة إشعار',
      testDedup: 'اختبار منع التكرار',
      grantPermission: 'منح إذن الإشعارات',
    },
    apis: {
      title: 'محرك إضافات الـ API الداخلي',
      subtitle: 'نظام إضافات متقدم يعتمد على قوالب JSON قابلة للتوليد بالذكاء الاصطناعي والاستيراد والتشغيل الداخلي',
      tabInstalled: 'الإضافات المثبّتة',
      tabImportAi: 'توليد بالذكاء واستيراد JSON',
      tabSandbox: 'منصة الاختبار',
      tabRecords: 'التخزين الداخلي',
      tabRoutines: 'الروتين اليومي',
      installedCount: 'إضافات',
      actionsCount: 'أوامر',
      internalBadge: 'دعم داخلي',
      exportJson: 'تصدير JSON',
      copyJson: 'نسخ JSON',
      testAction: 'تجربة',
      deletePlugin: 'حذف',
      webhookPlaceholder: 'رابط Webhook اختياري (POST JSON)',
      uriPlaceholder: 'قالب رابط التطبيق Deep Link أو Android Intent',
      triggersLabel: 'كلمات التشغيل',
      aiGenTitle: 'توليد قالب إضافة JSON بالذكاء الاصطناعي',
      aiGenDesc: 'اوصف أي تطبيق أو أتمتة تريده بالعربي أو الإنجليزي ليتم إنشاء ملف JSON متوافق مع معيار Vicky Plugin v1.0 فوراً',
      aiPromptPlaceholder: 'مثال: إضافة لتطبيق البيت الذكي لتشغيل وإطفاء الإضاءة وضبط حرارة التكييف عبر Webhook...',
      generateBtn: 'توليد قالب JSON',
      generatingBtn: 'جاري التوليد...',
      copyAiPromptBtn: 'نسخ البرومبت لأي ذكاء اصطناعي خارجي',
      copiedPromptToast: 'تم نسخ برومبت المطور — الصقه في أي AI للحصول على ملف JSON جاهز للاستيراد',
      presetGalleryTitle: 'قوالب JSON متقدمة جاهزة للاستيراد',
      presetGalleryDesc: 'حمّل أي قالب إلى المحرر لمراجعته أو استيراده بضغطة واحدة',
      loadPreset: 'تحميل القالب',
      jsonEditorTitle: 'محرر واستيراد قوالب JSON',
      jsonEditorDesc: 'الصق كود JSON من أي ذكاء اصطناعي أو ارفع ملف .json — يتم التحقق من صحة المخطط تلقائياً قبل الاستيراد',
      uploadJsonFile: 'رفع ملف .json',
      validateAndImport: 'تحقق واستيراد الإضافة',
      validSchema: 'قالب JSON سليم ومطابق لمعيار Vicky Plugin v1.0',
      invalidSchema: 'يوجد أخطاء في بنية JSON',
      warningsLabel: 'ملاحظات',
      sandboxTitle: 'منصة اختبار الإضافات الحية',
      sandboxDesc: 'نفّذ أي أمر من الإضافات المثبّتة مباشرة وافحص البيانات المرسلة والرابط الناتج وحالة الـ Webhook',
      selectPlugin: 'اختر الإضافة',
      selectAction: 'اختر الأمر',
      paramTextLabel: 'النص أو القيمة',
      paramMinutesLabel: 'المدة بالدقائق (اختياري)',
      runDispatchBtn: 'تنفيذ الأمر الآن',
      dispatchFeedTitle: 'سجل تنفيذ الـ API الحي',
      clearFeed: 'مسح السجل',
      noDispatches: 'لم يتم تنفيذ أي أمر API بعد. جرّب التنفيذ من الأعلى أو عبر الأوامر الصوتية.',
      launchUri: 'فتح الرابط',
      recordsTitle: 'التخزين الداخلي للإضافات',
      recordsDesc: 'البيانات والملاحظات المحفوظة داخلياً بواسطة الإضافات التي تدعم التنفيذ الداخلي (مثل كريستال والمهام)',
      saveRecordBtn: 'حفظ السجل',
      recordPlaceholder: 'أضف ملاحظة أو سجل داخلي جديد...',
      noRecords: 'لا توجد سجلات داخلية محفوظة بعد.',
      routinesTitle: 'الروتين اليومي المتعدد',
      runRoutine: 'تشغيل',
      createRoutineTitle: 'إنشاء روتين مخصص',
      routineNamePlaceholder: 'اسم الروتين (مثال: وقت المذاكرة)',
      routineStepsPlaceholder: 'الأوامر مفصولة بفاصلة (مثال: شغل عدم الإزعاج، خلي السطوع 40، اكتم الصوت)',
      addRoutineBtn: 'إضافة الروتين',
    },
    activity: {
      contactsTitle: 'دليل جهات الاتصال',
      contactsDesc: 'يُستخدم عند طلب إرسال رسائل واتساب أو SMS أو إجراء مكالمات بأي لغة',
      contactNamePlaceholder: 'الاسم (مثال: عمر)',
      contactAltNamePlaceholder: 'الاسم البديل أو الإنجليزي (اختياري)',
      contactPhonePlaceholder: '+2010...',
      addContactBtn: 'إضافة جهة اتصال',
      messageBtn: 'مراسلة',
      logsTitle: 'سجل النشاط',
      logsCount: 'حدث مسجّل',
      clearBtn: 'مسح',
      exportBtn: 'تصدير .txt',
      noLogs: 'لا يوجد نشاط مسجل بعد.',
    },
    overlay: {
      dockLabel: 'يا فيكي',
      thinking: 'جاري التفكير...',
      listening: 'تفضل، أستمع إليك...',
      placeholder: 'اسأل فيكي بأي لغة...',
      sendNow: 'إرسال الآن',
      smsFallback: 'إرسال عبر SMS',
      open: 'فتح',
    },
    dialogs: {
      clearLogsTitle: 'مسح سجل النشاط',
      clearLogsMsg: 'هل أنت متأكد من مسح جميع سجلات النشاط المسجّلة؟',
      clearConfirm: 'مسح السجل',
      cancel: 'إلغاء',
      voiceErrorTitle: 'خطأ في محرك الصوت',
      retry: 'إعادة المحاولة',
      cameraTitle: 'معاينة الكاميرا',
      cameraUnavailable: 'واجهة الكاميرا غير متوفرة في هذا المتصفح.',
    },
  },
};
