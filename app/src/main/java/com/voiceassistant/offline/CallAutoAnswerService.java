package com.voiceassistant.offline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.telecom.TelecomManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.lang.reflect.Method;
import android.telephony.TelephonyManager;

import java.util.HashMap;
import java.util.Locale;

public class CallAutoAnswerService extends Service {

    private static final String TAG = "CallAutoAnswerService";
    private static final String CHANNEL_ID = "call_auto_answer_channel";
    private static final int NOTIFICATION_ID = 2001;
    private static final int AUTO_ANSWER_DELAY = 10000; // 10 seconds
    
    private Handler handler;
    private Runnable autoAnswerRunnable;
    private TextToSpeech textToSpeech;
    private boolean isTTSReady = false;
    private boolean hasAnswered = false;
    private AudioManager audioManager;
    private int originalMicrophoneState;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "CallAutoAnswerService created");
        
        handler = new Handler(Looper.getMainLooper());
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        // Initialize TTS for offline message
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(Locale.US);
                if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                    isTTSReady = true;
                    Log.i(TAG, "TTS ready for offline message");
                    
                    // Set up utterance progress listener
                    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            Log.i(TAG, "TTS started speaking");
                            muteMicrophone(true);
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            Log.i(TAG, "TTS finished speaking");
                            muteMicrophone(false);
                            // Hang up the call after speaking
                            handler.postDelayed(() -> {
                                disconnectCall();
                            }, 500);
                        }

                        @Override
                        public void onError(String utteranceId) {
                            Log.e(TAG, "TTS error");
                            muteMicrophone(false);
                            disconnectCall();
                        }
                    });
                }
            }
        });
        
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createSilentNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if ("START_AUTO_ANSWER_TIMER".equals(action)) {
                startAutoAnswerTimer();
            } else if ("CANCEL_AUTO_ANSWER".equals(action)) {
                cancelAutoAnswerTimer();
                stopSelf();
            }
        }
        
        return START_NOT_STICKY;
    }

    private void startAutoAnswerTimer() {
        hasAnswered = false;
        
        // Cancel any existing timer
        if (autoAnswerRunnable != null) {
            handler.removeCallbacks(autoAnswerRunnable);
        }
        
        // Create new auto-answer runnable
        autoAnswerRunnable = new Runnable() {
            @Override
            public void run() {
                if (!hasAnswered) {
                    answerCall();
                }
            }
        };
        
        // Schedule auto-answer after 10 seconds
        handler.postDelayed(autoAnswerRunnable, AUTO_ANSWER_DELAY);
        Log.i(TAG, "Auto-answer timer started (10 seconds)");
    }

    private void answerCall() {
        try {
            hasAnswered = true;
            
            // Try to answer call using TelecomManager (Android 9+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                TelecomManager telecomManager = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
                if (telecomManager != null) {
                    telecomManager.acceptRingingCall();
                    Log.i(TAG, "Call answered using TelecomManager");
                }
            }
            
            // Wait a moment for call to connect, then speak offline message
            handler.postDelayed(() -> {
                speakOfflineMessage();
            }, 2000); // Wait 2 seconds for call to connect
            
        } catch (SecurityException e) {
            Log.e(TAG, "Permission denied to answer call", e);
        } catch (Exception e) {
            Log.e(TAG, "Error answering call", e);
        }
    }

    private void speakOfflineMessage() {
        if (isTTSReady && textToSpeech != null) {
            String offlineMessage = "Hello, I am AI made by Vicky and sir is not near phone. Please call later. Bye.";
            
            HashMap<String, String> params = new HashMap<>();
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "offline_msg");
            
            textToSpeech.speak(offlineMessage, TextToSpeech.QUEUE_FLUSH, params);
            Log.i(TAG, "Speaking offline message");
        }
    }
    
    private void muteMicrophone(boolean mute) {
        try {
            if (audioManager != null) {
                audioManager.setMicrophoneMute(mute);
                Log.i(TAG, "Microphone muted: " + mute);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error muting microphone", e);
        }
    }
    
    private void disconnectCall() {
        try {
            // Try using TelecomManager first (Android 9+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                TelecomManager telecomManager = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
                if (telecomManager != null) {
                    boolean result = telecomManager.endCall();
                    Log.i(TAG, "Call disconnected using TelecomManager: " + result);
                }
            } else {
                // For older versions, try reflection-based approach
                TelephonyManager telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (telephonyManager != null) {
                    try {
                        Class<?> clazz = Class.forName(telephonyManager.getClass().getName());
                        Method method = clazz.getDeclaredMethod("getITelephony");
                        method.setAccessible(true);
                        Object telephonyService = method.invoke(telephonyManager);
                        
                        if (telephonyService != null) {
                            Method endCallMethod = telephonyService.getClass().getDeclaredMethod("endCall");
                            endCallMethod.setAccessible(true);
                            endCallMethod.invoke(telephonyService);
                            Log.i(TAG, "Call disconnected using reflection");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error disconnecting call via reflection", e);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error disconnecting call", e);
        } finally {
            stopSelf();
        }
    }

    private void cancelAutoAnswerTimer() {
        if (autoAnswerRunnable != null) {
            handler.removeCallbacks(autoAnswerRunnable);
            autoAnswerRunnable = null;
        }
        Log.i(TAG, "Auto-answer timer cancelled");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Call Auto Answer",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Handles automatic call answering");
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setShowBadge(false);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createSilentNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Call Auto Answer")
                .setContentText("Monitoring incoming calls")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSound(null)
                .setVibrate(null)
                .setSilent(true)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        cancelAutoAnswerTimer();
        muteMicrophone(false);
        
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        
        Log.d(TAG, "CallAutoAnswerService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
