package com.voiceassistant.offline;

import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;
import org.vosk.LibVosk;
import org.vosk.LogLevel;
import org.vosk.Model;
import org.vosk.Recognizer;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Tiny always-on wake-word listener. Runs a small offline Vosk model restricted to the word "Vicky",
 * reads the mic with a plain AudioRecord (no audio focus, so music keeps playing) and releases the mic
 * completely as soon as the wake word is heard.
 */
public class HotwordDetector {

    public interface Callback {
        void onHotwordReady();
        void onHotwordError(String message);
        void onWake();
    }

    private static final String TAG = "HotwordDetector";
    private static final String ASSET_DIR = "model";
    private static final int SAMPLE_RATE = 16000;
    private static final String GRAMMAR = "[\"vicky\", \"vickie\", \"wiki\", \"[unk]\"]";
    private static final int LOUD_PEAK = 700;      // below this the room counts as quiet
    private static final int QUIET_CHUNKS_BEFORE_SLEEP = 8;   // ~1 s

    private final Context context;
    private final Callback callback;
    private final Handler main = new Handler(Looper.getMainLooper());

    private volatile Model model;
    private volatile boolean running = false;
    private volatile boolean wantRunning = false;
    private Thread thread;

    public HotwordDetector(Context context, Callback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    /** Loads the model on a background thread, then calls onHotwordReady(). */
    public void prepare() {
        new Thread(() -> {
            try {
                LibVosk.setLogLevel(LogLevel.WARNINGS);
                File dir = ensureModel();
                model = new Model(dir.getAbsolutePath());
                main.post(() -> {
                    callback.onHotwordReady();
                    if (wantRunning) start();
                });
            } catch (Throwable t) {
                Log.e(TAG, "Model load failed", t);
                final String msg = (t instanceof FileNotFoundException)
                        ? "Wake-word model not found in the app (assets/model is missing)"
                        : "Wake-word model failed to load: " + t.getMessage();
                main.post(() -> callback.onHotwordError(msg));
            }
        }, "hotword-prepare").start();
    }

    public synchronized void start() {
        wantRunning = true;
        if (model == null || running) return;
        running = true;
        thread = new Thread(this::loop, "hotword");
        thread.start();
    }

    /** Stops listening and blocks briefly until the microphone is released. */
    public synchronized void stop() {
        wantRunning = false;
        running = false;
        Thread t = thread;
        thread = null;
        if (t != null && t != Thread.currentThread()) {
            try { t.join(1500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        }
    }

    public void release() {
        stop();
        Model m = model;
        model = null;
        if (m != null) {
            try { m.close(); } catch (Throwable ignored) { }
        }
    }

    // ---------------------------------------------------------------- audio loop

    private void loop() {
        AudioRecord rec = null;
        Recognizer recognizer = null;
        boolean woke = false;
        String error = null;
        try {
            int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            int bufBytes = Math.max(minBuf, SAMPLE_RATE);
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufBytes);
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) {
                error = "Could not open the microphone (is another app using it?)";
                return;
            }
            recognizer = new Recognizer(model, SAMPLE_RATE, GRAMMAR);
            rec.startRecording();

            short[] buf = new short[2000];        // 125 ms
            int quiet = 0;
            boolean asleep = false;
            while (running) {
                int n = rec.read(buf, 0, buf.length);
                if (n < 0) { error = "Microphone read error " + n; break; }
                if (n == 0) continue;

                int peak = 0;
                for (int i = 0; i < n; i++) {
                    int a = Math.abs(buf[i]);
                    if (a > peak) peak = a;
                }
                if (peak > LOUD_PEAK) quiet = 0; else quiet++;

                // save battery: don't run the model on silence
                if (quiet > QUIET_CHUNKS_BEFORE_SLEEP) {
                    if (!asleep) { recognizer.reset(); asleep = true; }
                    continue;
                }
                asleep = false;

                boolean endOfUtterance = recognizer.acceptWaveForm(buf, n);
                String json = endOfUtterance ? recognizer.getResult() : recognizer.getPartialResult();
                if (heardWakeWord(json)) { woke = true; break; }
            }
        } catch (Throwable t) {
            Log.e(TAG, "Hotword loop failed", t);
            error = "Wake-word listener stopped: " + t.getMessage();
        } finally {
            if (rec != null) {
                try { rec.stop(); } catch (Throwable ignored) { }
                try { rec.release(); } catch (Throwable ignored) { }
            }
            if (recognizer != null) {
                try { recognizer.close(); } catch (Throwable ignored) { }
            }
            running = false;
            final boolean wakeFinal = woke;
            final String err = error;
            main.post(() -> {
                if (wakeFinal) callback.onWake();
                else if (err != null && wantRunning) callback.onHotwordError(err);
            });
        }
    }

    private static boolean heardWakeWord(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String text = o.has("partial") ? o.optString("partial") : o.optString("text");
            return text != null && !text.isEmpty() && Wake.extractCommand(text) != null;
        } catch (Exception e) {
            return false;
        }
    }

    // ---------------------------------------------------------------- model files

    /** The model ships inside the APK; copy it to internal storage once so Vosk can open it by path. */
    private File ensureModel() throws IOException {
        File dir = new File(context.getFilesDir(), "vosk-model");
        File ready = new File(dir, ".ready");
        if (ready.exists()) return dir;

        String[] top = context.getAssets().list(ASSET_DIR);
        if (top == null || top.length == 0) throw new FileNotFoundException("assets/" + ASSET_DIR);

        deleteRecursive(dir);
        copyAssets(ASSET_DIR, dir);
        if (!ready.createNewFile()) throw new IOException("Could not finish copying the model");
        return dir;
    }

    private void copyAssets(String assetPath, File dest) throws IOException {
        String[] children = context.getAssets().list(assetPath);
        if (children == null || children.length == 0) {
            File parent = dest.getParentFile();
            if (parent != null) parent.mkdirs();
            try (InputStream in = context.getAssets().open(assetPath);
                 OutputStream out = new FileOutputStream(dest)) {
                byte[] b = new byte[64 * 1024];
                int r;
                while ((r = in.read(b)) > 0) out.write(b, 0, r);
            }
        } else {
            dest.mkdirs();
            for (String name : children) copyAssets(assetPath + "/" + name, new File(dest, name));
        }
    }

    private static void deleteRecursive(File f) {
        if (!f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        f.delete();
    }
}
