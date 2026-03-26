package com.voiceassistant.offline;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.speech.tts.TextToSpeech;
import android.telephony.SmsMessage;
import android.telephony.TelephonyManager;
import android.util.Log;

import java.util.Locale;

public class CallSmsReceiver extends BroadcastReceiver {

    private static final String TAG = "CallSmsReceiver";
    private static TextToSpeech textToSpeech;
    private static boolean isTTSReady = false;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        if (action == null) return;

        // Initialize TTS if not already initialized
        if (textToSpeech == null) {
            initTTS(context);
        }

        if (action.equals(TelephonyManager.ACTION_PHONE_STATE_CHANGED)) {
            handleIncomingCall(context, intent);
        } else if (action.equals("android.provider.Telephony.SMS_RECEIVED")) {
            handleIncomingSMS(context, intent);
        }
    }

    private void initTTS(Context context) {
        textToSpeech = new TextToSpeech(context, status -> {
            if (status == TextToSpeech.SUCCESS) {
                // Try Hindi first
                int hindiResult = textToSpeech.setLanguage(new Locale("hi", "IN"));
                if (hindiResult == TextToSpeech.LANG_MISSING_DATA || hindiResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // Fallback to English
                    int englishResult = textToSpeech.setLanguage(Locale.US);
                    isTTSReady = (englishResult != TextToSpeech.LANG_MISSING_DATA && 
                                 englishResult != TextToSpeech.LANG_NOT_SUPPORTED);
                } else {
                    isTTSReady = true;
                }
                Log.i(TAG, "TTS initialized: " + isTTSReady);
            }
        });
    }

    private void handleIncomingCall(Context context, Intent intent) {
        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        String phoneNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);

        if (state != null && phoneNumber != null) {
            if (state.equals(TelephonyManager.EXTRA_STATE_RINGING)) {
                // Incoming call ringing
                String contactName = getContactName(context, phoneNumber);
                String message;
                
                if (contactName != null && !contactName.isEmpty()) {
                    message = "कॉल आ रहा है " + contactName + " से"; // "Call coming from [name]"
                } else {
                    message = "कॉल आ रहा है नंबर " + formatPhoneNumber(phoneNumber) + " से"; // "Call from number [number]"
                }
                
                speak(message);
                Log.i(TAG, "Incoming call: " + message);
                
                // Start auto-answer service
                Intent serviceIntent = new Intent(context, CallAutoAnswerService.class);
                serviceIntent.setAction("START_AUTO_ANSWER_TIMER");
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.i(TAG, "Auto-answer timer started");
                
            } else if (state.equals(TelephonyManager.EXTRA_STATE_OFFHOOK)) {
                // Call answered (either manually or auto)
                Log.i(TAG, "Call answered");
                
                // Cancel auto-answer if call was manually answered
                Intent serviceIntent = new Intent(context, CallAutoAnswerService.class);
                serviceIntent.setAction("CANCEL_AUTO_ANSWER");
                context.startService(serviceIntent);
                
            } else if (state.equals(TelephonyManager.EXTRA_STATE_IDLE)) {
                // Call ended
                Log.i(TAG, "Call ended");
                
                // Stop auto-answer service
                Intent serviceIntent = new Intent(context, CallAutoAnswerService.class);
                context.stopService(serviceIntent);
            }
        }
    }

    private void handleIncomingSMS(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        if (bundle != null) {
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus != null && pdus.length > 0) {
                SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdus[0]);
                String sender = smsMessage.getDisplayOriginatingAddress();
                String messageBody = smsMessage.getDisplayMessageBody();

                String contactName = getContactName(context, sender);
                String message;
                
                if (contactName != null && !contactName.isEmpty()) {
                    message = "संदेश आया है " + contactName + " से"; // "Message from [name]"
                } else {
                    message = "संदेश आया है नंबर " + formatPhoneNumber(sender) + " से"; // "Message from number [number]"
                }
                
                speak(message);
                Log.i(TAG, "Incoming SMS: " + message);
            }
        }
    }

    private String getContactName(Context context, String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return null;
        }

        Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber));
        String[] projection = {ContactsContract.PhoneLookup.DISPLAY_NAME};
        
        try {
            Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null);
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    String name = cursor.getString(0);
                    cursor.close();
                    return name;
                }
                cursor.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting contact name", e);
        }
        
        return null;
    }

    private String formatPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return "";
        }
        
        // Remove any non-digit characters
        String digits = phoneNumber.replaceAll("[^0-9]", "");
        
        // Convert digits to Hindi numbers and add spaces
        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            formatted.append(digits.charAt(i));
            if (i < digits.length() - 1) {
                formatted.append(" ");
            }
        }
        
        return formatted.toString();
    }

    private void speak(String text) {
        if (isTTSReady && textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
        }
    }

    public static void shutdown() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
    }
}
