# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Vosk library
-keep class org.vosk.** { *; }
-dontwarn org.vosk.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom classes
-keep class com.voiceassistant.offline.** { *; }

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile