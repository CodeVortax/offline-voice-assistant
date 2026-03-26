package com.voiceassistant.offline;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Locale;

public class VoiceRecognitionServiceNew implements RecognitionListener {

    private static final String TAG = "VoiceRecognitionService";
    private static final String WAKE_WORD = "vicky";
    private static final String WAKE_WORD_ALT1 = "wiki";
    private static final String WAKE_WORD_ALT2 = "vikki";
    private static final String WAKE_WORD_ALT3 = "viki";
    
    private SpeechRecognizer speechRecognizer;
    private Context context;
    private VoiceCallback callback;
    private CommandExecutor commandExecutor;
    private Handler mainHandler;
    private boolean wakeWordDetected = false;
    private WebSearchHelper webSearchHelper;
    private AudioManager audioManager;
    private boolean isListening = false;

    public interface VoiceCallback {
        void onVoiceResult(String text);
        void onVoiceError(String error);
        void onCommandExecuted(String command, boolean success);
        void onModelReady();
        void onModelError(String error);
    }

    public VoiceRecognitionServiceNew() {
        mainHandler = new Handler(Looper.getMainLooper());
    }

    public void setCallback(VoiceCallback callback) {
        this.callback = callback;
    }

    public void initialize(Context context) {
        this.context = context;
        this.commandExecutor = new CommandExecutor(context);
        this.webSearchHelper = new WebSearchHelper(context);
        this.audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
            speechRecognizer.setRecognitionListener(this);
            Log.i(TAG, "SpeechRecognizer initialized successfully");
            if (callback != null) {
                mainHandler.post(() -> callback.onModelReady());
            }
        } else {
            Log.e(TAG, "Speech recognition not available");
            if (callback != null) {
                mainHandler.post(() -> callback.onModelError("Speech recognition not available on this device"));
            }
        }
    }
    
    public void retryInitialization() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        initialize(context);
    }

    public boolean startListening() {
        if (speechRecognizer == null) {
            if (callback != null) {
                callback.onVoiceError("⚠️ Speech recognizer not initialized yet.");
            }
            return false;
        }

        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            
            speechRecognizer.startListening(intent);
            isListening = true;
            Log.i(TAG, "Started listening successfully");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start recognition", e);
            if (callback != null) {
                callback.onVoiceError("Failed to start recognition: " + e.getMessage());
            }
            return false;
        }
    }

    public void stopListening() {
        if (speechRecognizer != null && isListening) {
            speechRecognizer.stopListening();
            isListening = false;
        }
    }

    public void shutdown() {
        stopListening();
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }
    
    public void muteMicrophone(boolean mute) {
        if (audioManager != null) {
            audioManager.setMicrophoneMute(mute);
        }
    }

    // RecognitionListener callbacks
    @Override
    public void onReadyForSpeech(Bundle params) {
        Log.d(TAG, "Ready for speech");
    }

    @Override
    public void onBeginningOfSpeech() {
        Log.d(TAG, "Speech started");
    }

    @Override
    public void onRmsChanged(float rmsdB) {
        // Audio level changed
    }

    @Override
    public void onBufferReceived(byte[] buffer) {
        // Buffer received
    }

    @Override
    public void onEndOfSpeech() {
        Log.d(TAG, "Speech ended");
    }

    @Override
    public void onError(int error) {
        String errorMessage = getErrorText(error);
        Log.e(TAG, "Recognition error: " + errorMessage);
        
        if (callback != null) {
            mainHandler.post(() -> callback.onVoiceError(errorMessage));
        }
        
        // Auto-restart listening after error
        if (isListening) {
            mainHandler.postDelayed(() -> startListening(), 1000);
        }
    }

    @Override
    public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) {
            String text = matches.get(0);
            Log.i(TAG, "Final result: " + text);
            
            if (callback != null) {
                mainHandler.post(() -> callback.onVoiceResult(text));
            }
            
            processRecognizedText(text);
        }
        
        // Auto-restart listening
        if (isListening) {
            mainHandler.postDelayed(() -> startListening(), 500);
        }
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) {
            String text = matches.get(0);
            Log.d(TAG, "Partial: " + text);
            
            // Check for wake word in partial results
            String lowerText = text.toLowerCase();
            if (lowerText.contains(WAKE_WORD) || 
                lowerText.contains(WAKE_WORD_ALT1) || 
                lowerText.contains(WAKE_WORD_ALT2) || 
                lowerText.contains(WAKE_WORD_ALT3)) {
                wakeWordDetected = true;
                Log.i(TAG, "Wake word 'vicky' detected!");
            }
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) {
        // Event occurred
    }
    
    private void processRecognizedText(String text) {
        if (text == null || text.isEmpty()) return;
        
        String lowerText = text.toLowerCase();
        
        // Check if wake word is present
        if (lowerText.contains(WAKE_WORD) || 
            lowerText.contains(WAKE_WORD_ALT1) || 
            lowerText.contains(WAKE_WORD_ALT2) || 
            lowerText.contains(WAKE_WORD_ALT3)) {
            wakeWordDetected = true;
            
            // Process command after wake word
            String command = lowerText
                .replace(WAKE_WORD, "")
                .replace(WAKE_WORD_ALT1, "")
                .replace(WAKE_WORD_ALT2, "")
                .replace(WAKE_WORD_ALT3, "")
                .trim();
                
            if (!command.isEmpty()) {
                processCommand(command);
            }
        } else if (wakeWordDetected) {
            // If wake word was detected previously, process this as command
            processCommand(lowerText);
            wakeWordDetected = false;
        }
    }

    private void processCommand(String text) {
        String command = text.toLowerCase().trim();
        boolean success = false;
        String executedCommand = "";
        String response = "";

        // Time commands
        if (command.contains("time") || command.contains("what time")) {
            response = getCurrentTime();
            success = true;
            executedCommand = "Time is " + response;
        } 
        // Date commands
        else if (command.contains("date") || command.contains("today")) {
            response = getCurrentDate();
            success = true;
            executedCommand = "Today is " + response;
        }
        // Day commands
        else if (command.contains("what day") || command.contains("which day")) {
            response = getCurrentDay();
            success = true;
            executedCommand = "Today is " + response;
        }
        // App opening commands
        else if (command.contains("open whatsapp") || command.contains("whatsapp")) {
            success = commandExecutor.openApp("com.whatsapp");
            executedCommand = "Opening WhatsApp";
        } 
        else if (command.contains("open youtube") || command.contains("youtube")) {
            success = commandExecutor.openApp("com.google.android.youtube");
            executedCommand = "Opening YouTube";
        }
        else if (command.contains("open camera") || command.contains("camera")) {
            success = commandExecutor.openCamera();
            executedCommand = "Opening Camera";
        } 
        else if (command.contains("open chrome") || command.contains("browser")) {
            success = commandExecutor.openApp("com.android.chrome");
            executedCommand = "Opening Chrome";
        }
        else if (command.contains("open instagram") || command.contains("instagram")) {
            success = commandExecutor.openApp("com.instagram.android");
            executedCommand = "Opening Instagram";
        }
        else if (command.contains("open gmail") || command.contains("email")) {
            success = commandExecutor.openApp("com.google.android.gm");
            executedCommand = "Opening Gmail";
        }
        else if (command.contains("open settings") || command.contains("settings")) {
            success = commandExecutor.openSettings();
            executedCommand = "Opening Settings";
        }
        // Flashlight commands
        else if (command.contains("flashlight on") || command.contains("torch on")) {
            success = commandExecutor.toggleFlashlight(true);
            executedCommand = "Turning on flashlight";
        } 
        else if (command.contains("flashlight off") || command.contains("torch off")) {
            success = commandExecutor.toggleFlashlight(false);
            executedCommand = "Turning off flashlight";
        } 
        // Volume commands
        else if (command.contains("volume up") || command.contains("increase volume")) {
            success = commandExecutor.adjustVolume(true);
            executedCommand = "Increasing volume";
        }
        else if (command.contains("volume down") || command.contains("decrease volume")) {
            success = commandExecutor.adjustVolume(false);
            executedCommand = "Decreasing volume";
        }
        // Search commands
        else if (command.contains("search") || command.contains("google")) {
            String query = extractSearchQuery(command);
            success = commandExecutor.searchOnGoogle(query);
            executedCommand = "Searching for " + query;
        }
        // Web search with result
        else if (command.contains("what is") || command.contains("tell me about") || command.contains("who is")) {
            String query = extractSearchQuery(command);
            if (!query.isEmpty()) {
                executedCommand = "Searching for " + query;
                if (callback != null) {
                    final String cmd = executedCommand;
                    mainHandler.post(() -> callback.onCommandExecuted(cmd, true));
                }
                
                webSearchHelper.searchAndGetResult(query, new WebSearchHelper.SearchCallback() {
                    @Override
                    public void onSearchComplete(String result) {
                        Log.i(TAG, "Search result: " + result);
                        String response = query + ": " + result;
                        if (callback != null) {
                            mainHandler.post(() -> callback.onCommandExecuted(response, true));
                        }
                    }
                    
                    @Override
                    public void onSearchError(String error) {
                        Log.e(TAG, "Search error: " + error);
                        if (callback != null) {
                            mainHandler.post(() -> callback.onCommandExecuted("Sorry, search failed", false));
                        }
                    }
                });
                return;
            }
        }

        if (!executedCommand.isEmpty() && callback != null) {
            final String cmd = executedCommand;
            final boolean result = success;
            mainHandler.post(() -> callback.onCommandExecuted(cmd, result));
        }
    }

    private String getCurrentTime() {
        SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        return sdf.format(Calendar.getInstance().getTime());
    }

    private String getCurrentDate() {
        SimpleDateFormat sdf = new SimpleDateFormat("EEEE, MMMM dd, yyyy", Locale.getDefault());
        return sdf.format(Calendar.getInstance().getTime());
    }
    
    private String getCurrentDay() {
        SimpleDateFormat sdf = new SimpleDateFormat("EEEE", Locale.getDefault());
        return sdf.format(Calendar.getInstance().getTime());
    }

    private String extractSearchQuery(String command) {
        String query = command;
        query = query.replace("what is", "")
                    .replace("what are", "")
                    .replace("who is", "")
                    .replace("tell me about", "")
                    .replace("search for", "")
                    .replace("search", "")
                    .replace("google", "")
                    .trim();
        return query;
    }
    
    private String getErrorText(int errorCode) {
        switch (errorCode) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Audio recording error";
            case SpeechRecognizer.ERROR_CLIENT:
                return "Client side error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Insufficient permissions";
            case SpeechRecognizer.ERROR_NETWORK:
                return "Network error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Network timeout";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No recognition result matched";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Recognition service busy";
            case SpeechRecognizer.ERROR_SERVER:
                return "Server error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No speech input";
            default:
                return "Unknown error";
        }
    }
}
