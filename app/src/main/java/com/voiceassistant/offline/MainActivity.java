package com.voiceassistant.offline;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity implements VoiceService.Listener {

    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final String ACTION_NOTIFICATION = "com.voiceassistant.offline.NOTIFICATION_RECEIVED";

    private MaterialButton btnToggle, btnNotificationSettings, btnOverlay;
    private TextView tvStatus, tvHint, tvRecognizedText, tvLogs, tvNotificationStatus, tvRecentNotifications;
    private View statusDot;
    private View cardOverlay;
    private ScrollView scrollView;
    private MaterialSwitch switchNotifications;
    private ObjectAnimator pulse;

    private SharedPreferences notificationPrefs;
    private boolean updatingSwitch = false;

    private final SharedPreferences.OnSharedPreferenceChangeListener prefsListener = (p, key) -> {
        if (NotificationReaderService.PREF_ENABLED.equals(key)) runOnUiThread(this::syncNotificationSwitch);
    };

    private final BroadcastReceiver notificationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_NOTIFICATION.equals(intent.getAction())) return;
            String appName = intent.getStringExtra("app_name");
            String title = intent.getStringExtra("title");
            String text = intent.getStringExtra("text");
            runOnUiThread(() -> {
                addLog("Notification: " + appName + (TextUtils.isEmpty(title) ? "" : " – " + title));
                tvRecentNotifications.setVisibility(View.VISIBLE);
                tvRecentNotifications.setText(appName + "\n" + (title == null ? "" : title) + "\n" + (text == null ? "" : text));
            });
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        applySystemBars();
        initViews();
        checkPermissions();

        notificationPrefs = getSharedPreferences(NotificationReaderService.PREFS_NAME, Context.MODE_PRIVATE);
        notificationPrefs.registerOnSharedPreferenceChangeListener(prefsListener);
        syncNotificationSwitch();

        IntentFilter filter = new IntentFilter(ACTION_NOTIFICATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(notificationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(notificationReceiver, filter);
        }
    }

    private void applySystemBars() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(!night);
        c.setAppearanceLightNavigationBars(!night);
    }

    private void initViews() {
        btnToggle = findViewById(R.id.btnToggle);
        btnNotificationSettings = findViewById(R.id.btnNotificationSettings);
        btnOverlay = findViewById(R.id.btnOverlay);
        cardOverlay = findViewById(R.id.cardOverlay);
        tvStatus = findViewById(R.id.tvStatus);
        tvHint = findViewById(R.id.tvHint);
        tvRecognizedText = findViewById(R.id.tvRecognizedText);
        tvLogs = findViewById(R.id.tvLogs);
        tvNotificationStatus = findViewById(R.id.tvNotificationStatus);
        tvRecentNotifications = findViewById(R.id.tvRecentNotifications);
        statusDot = findViewById(R.id.statusDot);
        scrollView = findViewById(R.id.scrollView);
        switchNotifications = findViewById(R.id.switchNotifications);

        btnToggle.setOnClickListener(v -> toggleListening());
        btnNotificationSettings.setOnClickListener(v -> openNotificationSettings());
        btnOverlay.setOnClickListener(v -> openOverlaySettings());
        findViewById(R.id.btnClearLogs).setOnClickListener(v -> clearLogs());
        findViewById(R.id.btnExportLogs).setOnClickListener(v -> exportLogs());

        switchNotifications.setOnCheckedChangeListener((b, isChecked) -> {
            if (updatingSwitch) return;
            notificationPrefs.edit().putBoolean(NotificationReaderService.PREF_ENABLED, isChecked).apply();
            addLog(isChecked ? "Notification reading on" : "Notification reading off");
            if (isChecked && !isNotificationAccessGranted()) openNotificationSettings();
        });

        // tap the status text to stop/start too
        tvStatus.setOnClickListener(v -> toggleListening());
    }

    // ---------------------------------------------------------------- service control

    private void toggleListening() {
        if (VoiceService.running) {
            startService(new Intent(this, VoiceService.class).setAction(VoiceService.ACTION_STOP));
            renderRunning(false);
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Microphone permission is required", Toast.LENGTH_LONG).show();
                checkPermissions();
                return;
            }
            ContextCompat.startForegroundService(this, new Intent(this, VoiceService.class).setAction(VoiceService.ACTION_START));
            renderRunning(true);
            addLog("Starting…");
        }
    }

    private void renderRunning(boolean running) {
        btnToggle.setText(running ? "Stop listening" : "Start listening");
        btnToggle.setIconResource(running ? R.drawable.ic_stop : R.drawable.ic_mic);
        if (!running) tvStatus.setText("Idle");
        if (running) {
            if (pulse == null) {
                pulse = ObjectAnimator.ofFloat(statusDot, View.ALPHA, 0.25f, 1f);
                pulse.setDuration(900);
                pulse.setRepeatMode(ObjectAnimator.REVERSE);
                pulse.setRepeatCount(ObjectAnimator.INFINITE);
                pulse.setInterpolator(new LinearInterpolator());
            }
            if (!pulse.isStarted()) pulse.start();
        } else {
            if (pulse != null) pulse.cancel();
            statusDot.setAlpha(0.35f);
        }
    }

    // ---------------------------------------------------------------- VoiceService.Listener

    @Override
    public void onState(String state) {
        runOnUiThread(() -> {
            if (VoiceService.running || !"Stopped".equals(state)) tvStatus.setText(state);
            if ("Stopped".equals(state)) renderRunning(false);
        });
    }

    @Override
    public void onHeard(String text) {
        runOnUiThread(() -> {
            tvRecognizedText.setText(text);
            addLog("Heard: " + text);
        });
    }

    @Override
    public void onResult(String message, boolean success) {
        runOnUiThread(() -> addLog((success ? "✓ " : "✗ ") + message));
    }

    @Override
    public void onLog(String message) {
        runOnUiThread(() -> addLog(message));
    }

    // ---------------------------------------------------------------- notifications access

    private void syncNotificationSwitch() {
        boolean enabled = notificationPrefs.getBoolean(NotificationReaderService.PREF_ENABLED, true);
        updatingSwitch = true;
        switchNotifications.setChecked(enabled);
        updatingSwitch = false;

        boolean granted = isNotificationAccessGranted();
        btnNotificationSettings.setVisibility(granted ? View.GONE : View.VISIBLE);
        if (!enabled) tvNotificationStatus.setText("Off");
        else tvNotificationStatus.setText(granted ? "On" : "On, but access is not granted");
    }

    private boolean isNotificationAccessGranted() {
        String pkg = getPackageName();
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            for (String name : flat.split(":")) {
                if (name.contains(pkg)) return true;
            }
        }
        return false;
    }

    private void openNotificationSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            Toast.makeText(this, "Enable Vicky in the list", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Failed to open settings", Toast.LENGTH_SHORT).show();
        }
    }

    private void openOverlaySettings() {
        try {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            Toast.makeText(this, "Failed to open settings", Toast.LENGTH_SHORT).show();
        }
    }

    // ---------------------------------------------------------------- permissions

    private void checkPermissions() {
        java.util.ArrayList<String> perms = new java.util.ArrayList<>();
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.SEND_SMS);
        perms.add(Manifest.permission.READ_CONTACTS);
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.READ_PHONE_STATE);
        perms.add(Manifest.permission.RECEIVE_SMS);
        perms.add(Manifest.permission.READ_SMS);
        perms.add(Manifest.permission.CALL_PHONE);
        perms.add(Manifest.permission.READ_CALL_LOG);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) perms.add(Manifest.permission.ANSWER_PHONE_CALLS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms.add(Manifest.permission.POST_NOTIFICATIONS);

        java.util.ArrayList<String> missing = new java.util.ArrayList<>();
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE
                && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Microphone permission is required for Vicky to work", Toast.LENGTH_LONG).show();
        }
    }

    // ---------------------------------------------------------------- logs

    private void clearLogs() {
        new MaterialAlertDialogBuilder(this)
                .setTitle("Clear activity")
                .setMessage("Remove all entries?")
                .setPositiveButton("Clear", (d, w) -> tvLogs.setText(""))
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void exportLogs() {
        String logs = tvLogs.getText().toString();
        if (logs.isEmpty()) {
            Toast.makeText(this, "No logs to export", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOCUMENTS);
            if (dir == null) dir = getFilesDir();
            if (!dir.exists()) dir.mkdirs();
            String ts = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File file = new File(dir, "vicky_logs_" + ts + ".txt");
            try (FileWriter w = new FileWriter(file)) { w.write(logs); }
            Toast.makeText(this, "Saved: " + file.getAbsolutePath(), Toast.LENGTH_LONG).show();
        } catch (IOException e) {
            Toast.makeText(this, "Export failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void addLog(String message) {
        String ts = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        tvLogs.append("[" + ts + "] " + message + "\n");
        scrollView.post(() -> scrollView.fullScroll(View.FOCUS_DOWN));
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onStart() {
        super.onStart();
        VoiceService.setListener(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        syncNotificationSwitch();
        renderRunning(VoiceService.running);
        if (VoiceService.running && "Idle".contentEquals(tvStatus.getText())) tvStatus.setText("Waiting for \"Vicky\"");
        cardOverlay.setVisibility(Settings.canDrawOverlays(this) ? View.GONE : View.VISIBLE);
    }

    @Override
    protected void onStop() {
        VoiceService.setListener(null);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (pulse != null) pulse.cancel();
        if (notificationPrefs != null) notificationPrefs.unregisterOnSharedPreferenceChangeListener(prefsListener);
        try { unregisterReceiver(notificationReceiver); } catch (Exception ignored) { }
    }
}
