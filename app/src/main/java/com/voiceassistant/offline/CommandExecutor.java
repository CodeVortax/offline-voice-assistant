package com.voiceassistant.offline;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

public class CommandExecutor {

    private static final String TAG = "CommandExecutor";
    private Context context;
    private CameraManager cameraManager;
    private String cameraId;
    private boolean isFlashlightOn = false;

    public CommandExecutor(Context context) {
        this.context = context;
        initFlashlight();
    }

    private void initFlashlight() {
        try {
            cameraManager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
            if (cameraManager != null) {
                String[] cameraIds = cameraManager.getCameraIdList();
                if (cameraIds.length > 0) {
                    cameraId = cameraIds[0];
                }
            }
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to initialize camera", e);
        }
    }

    public boolean openApp(String packageName) {
        try {
            PackageManager pm = context.getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage(packageName);
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                Log.i(TAG, "Opened app: " + packageName);
                return true;
            } else {
                Log.w(TAG, "App not found: " + packageName);
                showToast("App not installed: " + packageName);
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app: " + packageName, e);
            return false;
        }
    }

    public boolean openCamera() {
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened camera");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open camera", e);
            return false;
        }
    }

    public boolean openMusicPlayer() {
        try {
            // Try opening default music player
            Intent intent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened music player");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open music player", e);
            // Fallback to search for music apps
            return openApp("com.google.android.music") || 
                   openApp("com.spotify.music") || 
                   openApp("com.google.android.apps.youtube.music");
        }
    }

    public boolean toggleFlashlight(boolean turnOn) {
        if (cameraManager == null || cameraId == null) {
            Log.e(TAG, "Camera manager not initialized");
            showToast("Flashlight not available");
            return false;
        }

        try {
            cameraManager.setTorchMode(cameraId, turnOn);
            isFlashlightOn = turnOn;
            Log.i(TAG, "Flashlight " + (turnOn ? "ON" : "OFF"));
            showToast("Flashlight " + (turnOn ? "ON" : "OFF"));
            return true;
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to toggle flashlight", e);
            return false;
        }
    }

    public boolean sendMessage(String contactName) {
        try {
            // Open SMS app with contact
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("sms:"));
            intent.putExtra("sms_body", "Message from Tiru Voice Assistant");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened SMS for contact: " + contactName);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to send message", e);
            return false;
        }
    }

    public boolean makeCall(String contactName) {
        try {
            // Open dialer with contact name
            Intent intent = new Intent(Intent.ACTION_DIAL);
            // You can add phone number here if you have contact lookup
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened dialer for: " + contactName);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to make call", e);
            return false;
        }
    }

    public boolean searchOnGoogle(String query) {
        try {
            // Open Google search
            Intent intent = new Intent(Intent.ACTION_WEB_SEARCH);
            intent.putExtra("query", query);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Searching on Google: " + query);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to search on Google", e);
            // Fallback to browser
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, 
                    Uri.parse("https://www.google.com/search?q=" + Uri.encode(query)));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(browserIntent);
                return true;
            } catch (Exception ex) {
                return false;
            }
        }
    }

    public boolean openYouTubeWithSearch(String query) {
        try {
            // Try to open YouTube app with search
            Intent intent = new Intent(Intent.ACTION_SEARCH);
            intent.setPackage("com.google.android.youtube");
            intent.putExtra("query", query);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opening YouTube with search: " + query);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open YouTube with search", e);
            // Fallback to browser
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, 
                    Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query)));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(browserIntent);
                return true;
            } catch (Exception ex) {
                return openApp("com.google.android.youtube");
            }
        }
    }

    public boolean openCalculator() {
        try {
            Intent intent = new Intent();
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_APP_CALCULATOR);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened calculator");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open calculator", e);
            return openApp("com.google.android.calculator");
        }
    }

    public boolean openSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened settings");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open settings", e);
            return false;
        }
    }

    public boolean openGallery() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setType("image/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened gallery");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open gallery", e);
            return false;
        }
    }

    public boolean openContacts() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(ContactsContract.Contacts.CONTENT_URI);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened contacts");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open contacts", e);
            return false;
        }
    }

    public boolean openClock() {
        try {
            Intent intent = new Intent(android.provider.AlarmClock.ACTION_SHOW_ALARMS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened clock");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open clock", e);
            return openApp("com.google.android.deskclock");
        }
    }

    public boolean adjustVolume(boolean increase) {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int direction = increase ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER;
                audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI);
                Log.i(TAG, "Volume " + (increase ? "increased" : "decreased"));
                return true;
            }
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Failed to adjust volume", e);
            return false;
        }
    }

    public boolean muteVolume() {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, AudioManager.FLAG_SHOW_UI);
                Log.i(TAG, "Volume muted");
                showToast("Volume muted");
                return true;
            }
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Failed to mute volume", e);
            return false;
        }
    }

    public boolean adjustBrightness(boolean increase) {
        try {
            // Open brightness settings as direct brightness control requires system permissions
            Intent intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            showToast("Please adjust brightness manually");
            Log.i(TAG, "Opened brightness settings");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open brightness settings", e);
            return false;
        }
    }

    public boolean openWifiSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened WiFi settings");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open WiFi settings", e);
            return false;
        }
    }

    public boolean openBluetoothSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            Log.i(TAG, "Opened Bluetooth settings");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open Bluetooth settings", e);
            return false;
        }
    }

    private void showToast(String message) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
    }

    public void cleanup() {
        if (isFlashlightOn) {
            toggleFlashlight(false);
        }
    }
}
