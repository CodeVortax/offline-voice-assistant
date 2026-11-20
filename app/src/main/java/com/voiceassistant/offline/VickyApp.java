package com.voiceassistant.offline;

import android.app.Application;

import com.google.android.material.color.DynamicColors;

public class VickyApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        // Material You: follow the wallpaper colours on Android 12+, Google blue otherwise
        DynamicColors.applyToActivitiesIfAvailable(this);
    }
}
