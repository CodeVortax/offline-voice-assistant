package com.voiceassistant.offline;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Always-on listener (foreground service). Works like "Hey Google":
 * say "Vicky" + command in one go, or say "Vicky", wait for "Yes?", then say the command.
 */
public class VoiceService extends Service implements RecognitionListener, HotwordDetector.Callback {

    private static final String TAG = "VoiceService";
    public static final String ACTION_START = "com.voiceassistant.offline.START";
    public static final String ACTION_STOP = "com.voiceassistant.offline.STOP";
    private static final String CHANNEL_ID = "vicky_listening";
    private static final int NOTIF_ID = 42;
    private static final long COMMAND_WATCHDOG_MS = 20000;

    public interface Listener {
        void onState(String state);
        void onHeard(String text);
        void onResult(String message, boolean success);
        void onLog(String message);
    }

    public static volatile boolean running = false;
    private static Listener listener;

    public static void setListener(Listener l) { listener = l; }

    private Handler handler;
    private HotwordDetector hotword;
    private SpeechRecognizer recognizer;
    private CommandExecutor executor;
    private AppMatcher appMatcher;
    private WebSearchHelper webSearch;
    private AudioManager audio;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    private boolean active = false;
    private boolean busy = false;        // true from "Vicky" until the command is finished
    private boolean speaking = false;
    private boolean preferOffline = true;
    private boolean retriedOnline = false;
    private boolean beepMuted = false;
    private int utteranceCounter = 0;

    private final Runnable resume = this::resumeHotword;
    private final Runnable watchdog = () -> {
        log("Timed out waiting for the command");
        resumeHotword();
    };
    private final Runnable unmuteBeep = this::unmuteBeepNow;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            log("Microphone permission missing");
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            Notification n = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            log("Could not start in background: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!active) {
            active = true;
            running = true;
            handler = new Handler(Looper.getMainLooper());
            executor = new CommandExecutor(this);
            appMatcher = new AppMatcher(this);
            webSearch = new WebSearchHelper(this);
            audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            initTts();
            if (listener != null) listener.onState("Getting ready…");
            hotword = new HotwordDetector(this, this);
            hotword.start();      // marks "want running"; actually starts once the model is loaded
            hotword.prepare();
        }
        return START_STICKY;
    }

    // ---------------------------------------------------------------- hotword callbacks

    @Override
    public void onHotwordReady() {
        log("Ready. Say \"Vicky\", wait for the beep, then give a command");
        emitState();
    }

    @Override
    public void onHotwordError(String message) {
        log(message);
        if (listener != null) listener.onState("Wake word unavailable");
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        stopSelf();
    }

    @Override
    public void onWake() {
        if (!active || busy) return;
        busy = true;
        hotword.stop();                       // give the mic back
        log("Wake word heard");
        emitState();
        beep();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, COMMAND_WATCHDOG_MS);
        handler.postDelayed(this::listenForCommand, 300);
    }

    private void resumeHotword() {
        handler.removeCallbacks(resume);
        handler.removeCallbacks(watchdog);
        busy = false;
        speaking = false;
        if (!active) return;
        try { if (recognizer != null) recognizer.cancel(); } catch (Exception ignored) { }
        hotword.start();
        emitState();
    }

    /** Give the recogniser a moment to release the mic before the wake-word listener takes it back. */
    private void done() {
        handler.removeCallbacks(resume);
        handler.postDelayed(resume, 400);
    }

    // ---------------------------------------------------------------- setup

    private Notification buildNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Vicky listening", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stop = new Intent(this, VoiceService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_mic)
                .setContentTitle("Vicky is ready")
                .setContentText("Say \"Vicky\" to give a command")
                .setContentIntent(openPi)
                .addAction(0, "Stop", stopPi)
                .setOngoing(true)
                .setSilent(true)
                .build();
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.US);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                // assistant-style speech so other audio is ducked instead of stopped
                tts.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { handler.post(VoiceService.this::speechFinished); }
                    @Override public void onError(String id) { handler.post(VoiceService.this::speechFinished); }
                });
            }
        });
    }

    private boolean createRecognizer() {
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            log("Speech recognition is not available on this device");
            return false;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(this);
        return true;
    }

    private void beep() {
        try {
            final ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_MUSIC, 70);
            tg.startTone(ToneGenerator.TONE_PROP_ACK, 150);
            handler.postDelayed(tg::release, 500);
        } catch (Exception ignored) { }
    }

    // ---------------------------------------------------------------- command listening (only after "Vicky")

    private void listenForCommand() {
        if (!active || !busy) return;
        if (recognizer == null && !createRecognizer()) { done(); return; }

        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        try {
            muteBeep();
            recognizer.startListening(i);
        } catch (Exception e) {
            Log.e(TAG, "startListening failed", e);
            createRecognizer();
            done();
        }
    }

    private void muteBeep() {
        // the recogniser plays a start beep; silence the notification/system streams for a moment
        if (audio == null || beepMuted) return;
        try {
            boolean n = audio.isStreamMute(AudioManager.STREAM_NOTIFICATION);
            boolean s = audio.isStreamMute(AudioManager.STREAM_SYSTEM);
            if (!n) audio.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_MUTE, 0);
            if (!s) audio.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0);
            beepMuted = !n || !s;
            handler.removeCallbacks(unmuteBeep);
            handler.postDelayed(unmuteBeep, 900);
        } catch (Exception ignored) { }
    }

    private void unmuteBeepNow() {
        if (audio == null || !beepMuted) return;
        beepMuted = false;
        try {
            audio.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_UNMUTE, 0);
            audio.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0);
        } catch (Exception ignored) { }
    }

    private void emitState() {
        if (listener == null) return;
        String s;
        if (!active) s = "Stopped";
        else if (speaking) s = "Speaking";
        else if (busy) s = "Listening for your command";
        else s = "Waiting for \"Vicky\"";
        listener.onState(s);
    }

    // ---------------------------------------------------------------- RecognitionListener

    @Override public void onReadyForSpeech(Bundle params) { }
    @Override public void onBeginningOfSpeech() { }
    @Override public void onRmsChanged(float rmsdB) { }
    @Override public void onBufferReceived(byte[] buffer) { }
    @Override public void onEndOfSpeech() { }
    @Override public void onPartialResults(Bundle partialResults) { }
    @Override public void onEvent(int eventType, Bundle params) { }

    @Override
    public void onResults(Bundle results) {
        retriedOnline = false;
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) { done(); return; }
        handleHeard(matches);
    }

    @Override
    public void onError(int error) {
        if (!busy) return;
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                log("Didn't catch a command");
                done();
                return;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                log("Microphone permission was revoked");
                stopSelf();
                return;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
            case SpeechRecognizer.ERROR_CLIENT:
                createRecognizer();
                done();
                return;
            case 12: // ERROR_LANGUAGE_NOT_SUPPORTED
            case 13: // ERROR_LANGUAGE_UNAVAILABLE
                if (preferOffline && !retriedOnline) {
                    preferOffline = false;
                    retriedOnline = true;
                    log("Offline English pack unavailable, using the online recogniser");
                    handler.postDelayed(this::listenForCommand, 300);
                } else {
                    done();
                }
                return;
            default:
                log("Recognition error: " + errorText(error));
                done();
        }
    }

    // ---------------------------------------------------------------- understanding speech

    private void handleHeard(ArrayList<String> matches) {
        String top = matches.get(0);
        if (listener != null) listener.onHeard(top);

        // user may have said "Vicky, open youtube" again inside the command: strip the name
        String command = null;
        for (String cand : matches) {
            String c = Wake.extractCommand(cand);
            if (c != null) { command = c; break; }
        }
        if (command == null) command = top;
        if (command.trim().isEmpty()) { done(); return; }
        runCommand(command);
    }

    private void runCommand(String raw) {
        String c = raw.toLowerCase(Locale.ROOT).trim().replaceAll("^(please|can you|could you)\\s+", "");
        log("Command: " + c);

        if (hasAny(c, "stop listening", "go to sleep", "good bye", "goodbye")) {
            finish("Okay, going to sleep", true, true);
            handler.postDelayed(this::stopSelf, 2000);
            return;
        }

        if (c.contains("notification") && hasAny(c, "read", "reader", "reading", "speak", "announce")) {
            boolean off = hasAny(c, "stop", "disable", "off", "don't", "do not", "mute", "quiet", "no more");
            SharedPreferences p = getSharedPreferences(NotificationReaderService.PREFS_NAME, MODE_PRIVATE);
            p.edit().putBoolean(NotificationReaderService.PREF_ENABLED, !off).apply();
            finish(off ? "Notification reading is off" : "Notification reading is on", true, false);
            return;
        }

        if (c.contains("what day") || c.contains("which day")) { finish("Today is " + fmt("EEEE"), true, true); return; }
        if (Pattern.compile("\\btime\\b").matcher(c).find()) { finish("It is " + fmt("hh:mm a"), true, true); return; }
        if (Pattern.compile("\\b(date|today)\\b").matcher(c).find()) { finish(fmt("EEEE, MMMM dd, yyyy"), true, true); return; }

        if (Pattern.compile("flash ?light|torch|\\bflash\\b").matcher(c).find()) {
            boolean off = Pattern.compile("\\boff\\b|turn it off|stop").matcher(c).find();
            finish(off ? "Flashlight off" : "Flashlight on", executor.toggleFlashlight(!off), false);
            return;
        }

        Matcher open = Pattern.compile("^(?:open|launch|start|run|go to|show me|show)\\s+(.+)$").matcher(c);
        if (open.find()) { openByName(open.group(1).trim()); return; }

        if (hasAny(c, "volume up", "increase volume", "raise volume", "louder")) { finish("Volume up", executor.adjustVolume(true), false); return; }
        if (hasAny(c, "volume down", "decrease volume", "lower volume", "quieter")) { finish("Volume down", executor.adjustVolume(false), false); return; }
        if (c.equals("mute") || c.contains("mute volume") || c.contains("mute the volume")) { finish("Muted", executor.muteVolume(), false); return; }

        if (c.contains("wifi") || c.contains("wi-fi") || c.contains("wi fi")) { finish("Opening Wi-Fi settings", executor.openWifiSettings(), false); return; }
        if (c.contains("bluetooth")) { finish("Opening Bluetooth settings", executor.openBluetoothSettings(), false); return; }

        Matcher search = Pattern.compile("^(?:search for|search|google|look up)\\s+(.+)$").matcher(c);
        if (search.find()) {
            String q = search.group(1).trim();
            finish("Searching for " + q, executor.searchOnGoogle(q), false);
            return;
        }

        Matcher ask = Pattern.compile("^(?:what is|what are|who is|who are|tell me about)\\s+(.+)$").matcher(c);
        if (ask.find()) {
            final String q = ask.group(1).trim();
            log("Looking up " + q);
            webSearch.searchAndGetResult(q, new WebSearchHelper.SearchCallback() {
                @Override public void onSearchComplete(String result) {
                    handler.post(() -> finish(q + ": " + result, true, true));
                }
                @Override public void onSearchError(String error) {
                    handler.post(() -> finish("Sorry, the search failed", false, true));
                }
            });
            return;
        }

        // last resort: maybe they just said an app name
        AppMatcher.Match m = c.split("\\s+").length <= 3 ? appMatcher.find(c) : null;
        if (m != null && m.score >= 0.8) { launch(m); return; }

        finish("Sorry, I didn't get that", false, true);
    }

    private void openByName(String name) {
        String n = Fuzzy.normalize(name);
        if (n.equals("camera")) { finish("Opening Camera", executor.openCamera(), false); return; }
        if (n.equals("settings") || n.equals("setting")) { finish("Opening Settings", executor.openSettings(), false); return; }

        AppMatcher.Match m = appMatcher.find(name);
        if (m == null) { finish("I couldn't find an app called " + name, false, true); return; }
        launch(m);
    }

    private void launch(AppMatcher.Match m) {
        boolean ok = executor.openApp(m.app.pkg);
        if (ok) log(String.format(Locale.US, "Matched \"%s\" (%.0f%%)", m.app.label, m.score * 100));
        finish(ok ? "Opening " + m.app.label : "Could not open " + m.app.label, ok, !ok);
    }

    private static boolean hasAny(String s, String... needles) {
        for (String n : needles) if (s.contains(n)) return true;
        return false;
    }

    private static String fmt(String pattern) {
        return new SimpleDateFormat(pattern, Locale.getDefault()).format(Calendar.getInstance().getTime());
    }

    // ---------------------------------------------------------------- output

    /** Actions are silent (so music isn't interrupted); only answers and errors are spoken. */
    private void finish(String text, boolean ok, boolean speakIt) {
        if (listener != null) listener.onResult(text, ok);
        if (speakIt) {
            speak(text);
        } else {
            Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
            done();
        }
    }

    private void speak(String text) {
        if (!ttsReady || tts == null) { done(); return; }
        speaking = true;
        emitState();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "v" + (++utteranceCounter));
    }

    private void speechFinished() {
        speaking = false;
        done();
    }

    private void log(String msg) {
        Log.i(TAG, msg);
        if (listener != null) listener.onLog(msg);
    }

    private static String errorText(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_AUDIO: return "audio recording error";
            case SpeechRecognizer.ERROR_NETWORK: return "network error (offline English pack may be missing)";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network timeout";
            case SpeechRecognizer.ERROR_SERVER: return "server error";
            default: return "code " + code;
        }
    }

    @Override
    public void onDestroy() {
        active = false;
        running = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        unmuteBeepNow();
        if (hotword != null) hotword.release();
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (executor != null) executor.cleanup();
        if (listener != null) {
            listener.onState("Stopped");
            listener.onLog("Stopped listening");
        }
        super.onDestroy();
    }
}
