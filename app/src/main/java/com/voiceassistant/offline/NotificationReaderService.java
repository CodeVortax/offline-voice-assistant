package com.voiceassistant.offline;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class NotificationReaderService extends NotificationListenerService {

    private static final String TAG = "NotificationReader";
    private TextToSpeech textToSpeech;
    private boolean isTTSReady = false;
    private SharedPreferences prefs;
    public static final String PREFS_NAME = "NotificationReaderPrefs";
    public static final String PREF_ENABLED = "notification_reading_enabled";
    
    // Track read notifications to prevent repeating
    private LinkedHashMap<String, Long> readNotifications = new LinkedHashMap<String, Long>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            // Remove entries older than 5 minutes to prevent memory issues
            return System.currentTimeMillis() - eldest.getValue() > 5 * 60 * 1000;
        }
    };
    private static final int MAX_CACHE_SIZE = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "NotificationReaderService created");
        
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        // Initialize Text-to-Speech
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                // Try Hindi first, fallback to English
                int hindiResult = textToSpeech.setLanguage(new Locale("hi", "IN"));
                if (hindiResult == TextToSpeech.LANG_MISSING_DATA || hindiResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    int englishResult = textToSpeech.setLanguage(Locale.US);
                    if (englishResult == TextToSpeech.LANG_MISSING_DATA || englishResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        isTTSReady = false;
                        Log.e(TAG, "TTS Language not supported");
                    } else {
                        isTTSReady = true;
                        Log.i(TAG, "TTS ready (English)");
                    }
                } else {
                    isTTSReady = true;
                    Log.i(TAG, "TTS ready (Hindi)");
                }
            } else {
                Log.e(TAG, "TTS initialization failed");
                isTTSReady = false;
            }
        });
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        super.onNotificationPosted(sbn);
        
        // Check if notification reading is enabled
        boolean isEnabled = prefs.getBoolean(PREF_ENABLED, true);
        if (!isEnabled || !isTTSReady) {
            return;
        }

        try {
            String packageName = sbn.getPackageName();
            Notification notification = sbn.getNotification();
            
            // Skip system and self notifications
            if (packageName.equals(getPackageName()) || 
                packageName.contains("android") || 
                packageName.contains("system")) {
                return;
            }

            Bundle extras = notification.extras;
            if (extras == null) {
                return;
            }

            // Extract notification data
            String appName = getAppName(packageName);
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            String text = extras.getCharSequence(Notification.EXTRA_TEXT, "").toString();
            String subText = extras.getString(Notification.EXTRA_SUB_TEXT, "");
            
            // Create unique notification ID to prevent repeating
            String notificationId = packageName + "_" + title + "_" + text + "_" + sbn.getPostTime();
            
            // Check if we already read this notification
            synchronized (readNotifications) {
                if (readNotifications.containsKey(notificationId)) {
                    Log.d(TAG, "Notification already read, skipping: " + notificationId);
                    return;
                }
                
                // Add to read notifications
                readNotifications.put(notificationId, System.currentTimeMillis());
                
                // Limit cache size
                if (readNotifications.size() > MAX_CACHE_SIZE) {
                    Iterator<String> iterator = readNotifications.keySet().iterator();
                    if (iterator.hasNext()) {
                        iterator.next();
                        iterator.remove();
                    }
                }
            }
            
            // Build the message to speak
            StringBuilder message = new StringBuilder();
            
            // Add app name
            if (!appName.isEmpty()) {
                message.append(appName).append(" notification");
            }
            
            // Add sender/title
            if (!title.isEmpty() && !title.equals(appName)) {
                message.append(" from ").append(title);
            }
            
            // Add message content
            if (!text.isEmpty()) {
                message.append(": ").append(text);
            } else if (!subText.isEmpty()) {
                message.append(": ").append(subText);
            }

            String finalMessage = message.toString();
            if (!finalMessage.isEmpty()) {
                Log.i(TAG, "Speaking notification: " + finalMessage);
                speakNotification(finalMessage);
                
                // Broadcast to MainActivity
                Intent intent = new Intent("com.voiceassistant.offline.NOTIFICATION_RECEIVED");
                intent.putExtra("app_name", appName);
                intent.putExtra("title", title);
                intent.putExtra("text", text);
                intent.putExtra("message", finalMessage);
                sendBroadcast(intent);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        super.onNotificationRemoved(sbn);
        Log.d(TAG, "Notification removed: " + sbn.getPackageName());
    }

    private String getAppName(String packageName) {
        try {
            return getPackageManager().getApplicationLabel(
                getPackageManager().getApplicationInfo(packageName, 0)
            ).toString();
        } catch (Exception e) {
            // Return package name if app name not found
            return packageName.substring(packageName.lastIndexOf('.') + 1);
        }
    }

    private void speakNotification(String message) {
        if (isTTSReady && textToSpeech != null) {
            // Stop ongoing speech and speak immediately to avoid repetition
            textToSpeech.stop();
            textToSpeech.speak(message, TextToSpeech.QUEUE_FLUSH, null, String.valueOf(System.currentTimeMillis()));
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        readNotifications.clear();
        Log.d(TAG, "NotificationReaderService destroyed");
    }
}