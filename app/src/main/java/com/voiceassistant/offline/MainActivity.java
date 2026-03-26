package com.voiceassistant.offline;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity implements VoiceRecognitionService.VoiceCallback {

    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final int NOTIFICATION_PERMISSION_CODE = 101;
    private Button btnStartListening;
    private Button btnStopListening;
    private Button btnClearLogs;
    private Button btnExportLogs;
    private Button btnNotificationSettings;
    private Button btnTelegram;
    private TextView tvStatus;
    private TextView tvRecognizedText;
    private TextView tvLogs;
    private TextView tvModelStatus;
    private TextView tvNotificationStatus;
    private TextView tvRecentNotifications;
    private ProgressBar progressBar;
    private ScrollView scrollView;
    private SwitchCompat switchNotifications;
    
    private VoiceRecognitionService voiceService;
    private boolean isListening = false;
    private boolean isModelReady = false;
    private TextToSpeech textToSpeech;
    private boolean isTTSReady = false;
    private SharedPreferences notificationPrefs;
    
    private BroadcastReceiver notificationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.voiceassistant.offline.NOTIFICATION_RECEIVED".equals(intent.getAction())) {
                String appName = intent.getStringExtra("app_name");
                String title = intent.getStringExtra("title");
                String text = intent.getStringExtra("text");
                String message = intent.getStringExtra("message");
                
                runOnUiThread(() -> {
                    addLog("🔔 " + message);
                    updateRecentNotification(appName, title, text);
                });
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        checkPermissions();
        initVoiceService();
        initNotificationService();
        
        // Register notification receiver with proper flags for Android 13+
        IntentFilter filter = new IntentFilter("com.voiceassistant.offline.NOTIFICATION_RECEIVED");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(notificationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(notificationReceiver, filter);
        }
    }

    private void initViews() {
        btnStartListening = findViewById(R.id.btnStartListening);
        btnStopListening = findViewById(R.id.btnStopListening);
        btnClearLogs = findViewById(R.id.btnClearLogs);
        btnExportLogs = findViewById(R.id.btnExportLogs);
        btnNotificationSettings = findViewById(R.id.btnNotificationSettings);
        btnTelegram = findViewById(R.id.btnTelegram);
        tvStatus = findViewById(R.id.tvStatus);
        tvRecognizedText = findViewById(R.id.tvRecognizedText);
        tvLogs = findViewById(R.id.tvLogs);
        tvModelStatus = findViewById(R.id.tvModelStatus);
        tvNotificationStatus = findViewById(R.id.tvNotificationStatus);
        tvRecentNotifications = findViewById(R.id.tvRecentNotifications);
        progressBar = findViewById(R.id.progressBar);
        scrollView = findViewById(R.id.scrollView);
        switchNotifications = findViewById(R.id.switchNotifications);

        btnStartListening.setOnClickListener(v -> startListening());
        btnStopListening.setOnClickListener(v -> stopListening());
        btnClearLogs.setOnClickListener(v -> clearLogs());
        btnExportLogs.setOnClickListener(v -> exportLogs());
        btnNotificationSettings.setOnClickListener(v -> openNotificationSettings());
        btnTelegram.setOnClickListener(v -> openTelegramChannel());
        
        if (switchNotifications != null) {
            switchNotifications.setOnCheckedChangeListener((buttonView, isChecked) -> {
                if (notificationPrefs != null) {
                    notificationPrefs.edit().putBoolean(NotificationReaderService.PREF_ENABLED, isChecked).apply();
                }
                updateNotificationStatus(isChecked);
                if (isChecked && !isNotificationAccessGranted()) {
                    openNotificationSettings();
                }
            });
        }
        
        btnStartListening.setEnabled(false);
        btnStopListening.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);
        tvModelStatus.setText("🔄 Loading voice model...");
    }
    
    private void initNotificationService() {
        try {
            notificationPrefs = getSharedPreferences(NotificationReaderService.PREFS_NAME, Context.MODE_PRIVATE);
            boolean isEnabled = notificationPrefs.getBoolean(NotificationReaderService.PREF_ENABLED, true);
            
            if (switchNotifications != null) {
                switchNotifications.setChecked(isEnabled);
            }
            updateNotificationStatus(isEnabled);
            
            // Check if notification access is granted
            if (isNotificationAccessGranted()) {
                addLog("✅ Notification access granted");
                if (btnNotificationSettings != null) {
                    btnNotificationSettings.setVisibility(View.GONE);
                }
            } else {
                addLog("⚠️ Notification access not granted");
                if (btnNotificationSettings != null) {
                    btnNotificationSettings.setVisibility(View.VISIBLE);
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error initializing notification service", e);
            addLog("⚠️ Error initializing notifications: " + e.getMessage());
        }
    }
    
    private boolean isNotificationAccessGranted() {
        String pkgName = getPackageName();
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            String[] names = flat.split(":");
            for (String name : names) {
                if (name.contains(pkgName)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    private void openNotificationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            startActivity(intent);
            Toast.makeText(this, "Please enable Soul Crack from the list", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Failed to open settings", Toast.LENGTH_SHORT).show();
        }
    }
    
    private void openTelegramChannel() {
        try {
            String channelUsername = "soulcrack";
            
            // Try to open in Telegram app first
            Intent telegramIntent = new Intent(Intent.ACTION_VIEW);
            telegramIntent.setData(Uri.parse("tg://resolve?domain=" + channelUsername));
            telegramIntent.setPackage("org.telegram.messenger");
            
            try {
                startActivity(telegramIntent);
                addLog("📱 Opening @soulcrack in Telegram app");
            } catch (Exception e) {
                // If Telegram app not installed, open in browser
                Intent browserIntent = new Intent(Intent.ACTION_VIEW);
                browserIntent.setData(Uri.parse("https://t.me/" + channelUsername));
                startActivity(browserIntent);
                addLog("🌐 Opening @soulcrack in browser");
            }
            
            Toast.makeText(this, "Join our Telegram channel @soulcrack!", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Failed to open Telegram channel", Toast.LENGTH_SHORT).show();
            Log.e("MainActivity", "Error opening Telegram", e);
        }
    }
    
    private void updateNotificationStatus(boolean isEnabled) {
        if (isEnabled) {
            tvNotificationStatus.setText("🔔 Notification Reader: Enabled");
            addLog("✅ Notification reading enabled");
        } else {
            tvNotificationStatus.setText("🔕 Notification Reader: Disabled");
            addLog("⏸️ Notification reading disabled");
        }
    }
    
    private void updateRecentNotification(String appName, String title, String text) {
        if (tvRecentNotifications != null) {
            String notification = String.format("📱 %s\n👤 %s\n💬 %s", 
                appName, title, text);
            tvRecentNotifications.setText(notification);
        }
    }

    private void initVoiceService() {
        voiceService = new VoiceRecognitionService();
        voiceService.setCallback(this);
        voiceService.initialize(this);
        
        // Initialize Text-to-Speech
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                // Try Hindi first, fallback to English if not available
                int hindiResult = textToSpeech.setLanguage(new Locale("hi", "IN"));
                if (hindiResult == TextToSpeech.LANG_MISSING_DATA || hindiResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    addLog("⚠️ Hindi not supported, using English");
                    int englishResult = textToSpeech.setLanguage(Locale.US);
                    if (englishResult == TextToSpeech.LANG_MISSING_DATA || englishResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        isTTSReady = false;
                        addLog("❌ TTS Language not supported");
                    } else {
                        isTTSReady = true;
                        addLog("✅ Text-to-Speech ready (English)");
                    }
                } else {
                    isTTSReady = true;
                    addLog("✅ Text-to-Speech ready (Hindi)");
                }
            } else {
                addLog("❌ TTS initialization failed");
                isTTSReady = false;
            }
        });
    }

    private void checkPermissions() {
        String[] permissions;
        
        // Add POST_NOTIFICATIONS permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions = new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.CAMERA,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.POST_NOTIFICATIONS,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.ANSWER_PHONE_CALLS,
                Manifest.permission.READ_CALL_LOG
            };
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions = new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.CAMERA,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.ANSWER_PHONE_CALLS,
                Manifest.permission.READ_CALL_LOG
            };
        } else {
            permissions = new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.CAMERA,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_CALL_LOG
            };
        }

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (!allGranted) {
                Toast.makeText(this, "Permissions are required for app to work", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void startListening() {
        if (!isModelReady) {
            Toast.makeText(this, "⚠️ Voice model is still loading. Please wait...", Toast.LENGTH_LONG).show();
            addLog("❌ Cannot start - Model not ready yet");
            return;
        }
        
        if (voiceService.startListening()) {
            isListening = true;
            btnStartListening.setEnabled(false);
            btnStopListening.setEnabled(true);
            tvStatus.setText("🎤 Status: Listening...");
            addLog("🎤 Started listening for voice commands");
        } else {
            Toast.makeText(this, "Failed to start voice recognition", Toast.LENGTH_SHORT).show();
            addLog("❌ Failed to start voice recognition");
        }
    }

    private void stopListening() {
        voiceService.stopListening();
        isListening = false;
        btnStartListening.setEnabled(true);
        btnStopListening.setEnabled(false);
        tvStatus.setText("⏸️ Status: Idle");
        addLog("⏹️ Stopped listening");
    }
    
    private void clearLogs() {
        new AlertDialog.Builder(this)
            .setTitle("Clear Logs")
            .setMessage("Are you sure you want to clear all activity logs?")
            .setPositiveButton("Yes", (dialog, which) -> {
                tvLogs.setText("");
                addLog("🗑️ Logs cleared");
            })
            .setNegativeButton("No", null)
            .show();
    }
    
    private void exportLogs() {
        try {
            String logs = tvLogs.getText().toString();
            if (logs.isEmpty()) {
                Toast.makeText(this, "No logs to export", Toast.LENGTH_SHORT).show();
                return;
            }
            
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "TiruAssistant");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File file = new File(dir, "logs_" + timestamp + ".txt");
            
            FileWriter writer = new FileWriter(file);
            writer.write("Tiru Voice Assistant - Activity Logs\n");
            writer.write("Exported: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()) + "\n");
            writer.write("=" + "=".repeat(50) + "\n\n");
            writer.write(logs);
            writer.close();
            
            Toast.makeText(this, "✅ Logs exported to: " + file.getAbsolutePath(), Toast.LENGTH_LONG).show();
            addLog("💾 Logs exported successfully");
        } catch (IOException e) {
            Toast.makeText(this, "❌ Failed to export logs: " + e.getMessage(), Toast.LENGTH_LONG).show();
            addLog("❌ Export failed: " + e.getMessage());
        }
    }

    @Override
    public void onVoiceResult(String text) {
        runOnUiThread(() -> {
            tvRecognizedText.setText("💬 You said: " + text);
            addLog("👂 Recognized: " + text);
        });
    }

    @Override
    public void onVoiceError(String error) {
        runOnUiThread(() -> {
            Toast.makeText(MainActivity.this, "❌ Error: " + error, Toast.LENGTH_LONG).show();
            addLog("❌ Error: " + error);
        });
    }

    @Override
    public void onCommandExecuted(String command, boolean success) {
        runOnUiThread(() -> {
            String message = success ? 
                "✅ Executed: " + command : 
                "❌ Failed to execute: " + command;
            addLog(message);
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
            
            // Speak the response
            if (success) {
                speak(command);
            } else {
                speak("Failed to execute " + command);
            }
        });
    }
    
    @Override
    public void onModelReady() {
        runOnUiThread(() -> {
            isModelReady = true;
            btnStartListening.setEnabled(true);
            progressBar.setVisibility(View.GONE);
            tvModelStatus.setText("✅ Voice model ready!");
            tvStatus.setText("✅ Status: Ready");
            addLog("✅ Voice model initialized successfully");
            Toast.makeText(MainActivity.this, "✅ Voice model loaded! You can start listening now.", Toast.LENGTH_LONG).show();
        });
    }
    
    @Override
    public void onModelError(String error) {
        runOnUiThread(() -> {
            isModelReady = false;
            btnStartListening.setEnabled(false);
            progressBar.setVisibility(View.GONE);
            tvModelStatus.setText("❌ Model failed to load");
            tvStatus.setText("❌ Status: Model Error");
            addLog("❌ Model initialization failed: " + error);
            
            new AlertDialog.Builder(this)
                .setTitle("Model Loading Failed")
                .setMessage("Failed to load voice model. Please ensure:\n\n" +
                    "1. You have downloaded the Vosk model\n" +
                    "2. The model is placed in: app/src/main/assets/model/\n" +
                    "3. The model folder contains: am/, conf/, graph/, ivector/\n\n" +
                    "Error: " + error)
                .setPositiveButton("Retry", (dialog, which) -> {
                    progressBar.setVisibility(View.VISIBLE);
                    tvModelStatus.setText("🔄 Retrying model load...");
                    voiceService.retryInitialization();
                })
                .setNegativeButton("Cancel", null)
                .show();
        });
    }

    private void addLog(String message) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String logEntry = "[" + timestamp + "] " + message + "\n";
        tvLogs.append(logEntry);
        scrollView.post(() -> scrollView.fullScroll(View.FOCUS_DOWN));
    }
    
    private void speak(String text) {
        if (isTTSReady && textToSpeech != null) {
            // Stop any ongoing speech
            textToSpeech.stop();
            // Speak the text
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
            addLog("🔊 Speaking: " + text);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (voiceService != null) {
            voiceService.shutdown();
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        try {
            unregisterReceiver(notificationReceiver);
        } catch (Exception e) {
            // Receiver not registered
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        // Update notification access status
        try {
            if (isNotificationAccessGranted()) {
                if (btnNotificationSettings != null) {
                    btnNotificationSettings.setVisibility(View.GONE);
                }
                addLog("✅ Notification access is active");
            } else {
                if (btnNotificationSettings != null) {
                    btnNotificationSettings.setVisibility(View.VISIBLE);
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error in onResume", e);
        }
    }
}