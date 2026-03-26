# 🎙️ Offline Voice Assistant - Vicky AI

[![Android](https://img.shields.io/badge/Platform-Android-green.svg)](https://android.com)
[![API](https://img.shields.io/badge/API-24%2B-brightgreen.svg)](https://android-arsenal.com/api?level=24)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0-orange.svg)](https://github.com/vikrant-project/offline-voice-assistant)

> **A powerful, privacy-focused offline voice assistant for Android that works without internet connection. Control your phone, get information, and stay productive with just your voice.**

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Why Choose Vicky AI?](#-why-choose-vicky-ai)
- [Key Features](#-key-features)
- [Comparison with Other Assistants](#-comparison-with-other-assistants)
- [Installation](#-installation)
- [Setup & Configuration](#️-setup--configuration)
- [Usage Guide](#-usage-guide)
- [Supported Commands](#-supported-commands)
- [Technical Architecture](#-technical-architecture)
- [Requirements](#-requirements)
- [Permissions Explained](#-permissions-explained)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#️-roadmap)
- [License](#-license)
- [Contact & Support](#-contact--support)

---

## 🌟 Overview

**Vicky AI** is an advanced offline voice assistant designed for Android devices that prioritizes **privacy, performance, and offline functionality**. Unlike cloud-dependent assistants like Google Assistant or Alexa, Vicky AI processes all voice commands locally on your device, ensuring your conversations remain private and work even without internet connectivity.

### 🎯 Purpose

In an era where digital privacy is paramount and internet connectivity isn't always guaranteed, Vicky AI offers:

- ✅ **Complete Privacy** - No data sent to external servers
- ✅ **Offline Functionality** - Works without internet connection
- ✅ **Zero Latency** - Instant command processing
- ✅ **Full Control** - Open-source and customizable
- ✅ **Accessibility** - Voice-first interaction for hands-free operation
- ✅ **Notification Intelligence** - Smart notification reading and management

---

## 🏆 Why Choose Vicky AI?

### **1. Privacy First** 🔒
Your voice data never leaves your device. Unlike Google Assistant, Alexa, or Siri, which send your voice recordings to cloud servers for processing, Vicky AI operates entirely offline.

### **2. Works Offline** 📡
Perfect for:
- Areas with poor network connectivity
- Flight mode scenarios
- Data-conscious users
- Privacy-sensitive environments
- Emergency situations

### **3. Lightweight & Fast** ⚡
- Minimal battery consumption
- Instant response time
- Small app size (~5MB)
- No continuous background syncing

### **4. Open Source & Customizable** 🛠️
- Fully customizable voice commands
- Add your own app integrations
- Modify wake words
- Extend functionality as needed

### **5. Comprehensive Device Control** 🎛️
Control every aspect of your Android device through voice commands - from opening apps to managing notifications, making calls, and controlling hardware features.

---

## 🚀 Key Features

### 🎤 Voice Recognition
- **Wake Word Activation**: "Vicky" (with alternatives: wiki, vikki, viki)
- **Continuous Listening Mode**: Always ready for your commands
- **Multi-language Support**: Hindi and English TTS
- **Partial Results Processing**: Responds before you finish speaking

### 📱 Smart Device Control
- **App Launcher**: Open any installed app by voice
  - WhatsApp, YouTube, Instagram, Gmail, Chrome, Camera, and more
- **Hardware Control**:
  - Flashlight on/off
  - Volume adjustment
  - Camera access
  - Brightness control (via settings)
- **System Actions**:
  - WiFi and Bluetooth settings
  - Display settings
  - Phone settings access

### 🔔 Intelligent Notification Reader
- **Real-time Notification Reading**: Automatically reads incoming notifications
- **App-based Filtering**: Choose which apps to read notifications from
- **Duplicate Prevention**: Smart algorithm prevents repeating the same notification
- **Toggle Control**: Enable/disable notification reading on demand
- **Recent Notifications Display**: Visual log of recent notifications

### 💬 Information & Search
- **Time & Date Queries**: "What time is it?", "What's the date?"
- **Web Search Integration**: "Search for..." or "Google..."
- **Knowledge Queries**: "What is...", "Tell me about..."
- **YouTube Search**: Search and play YouTube content

### 📞 Communication Features
- **Call Management**: Voice-initiated calls
- **SMS Support**: Send messages by voice
- **Contact Access**: Quick contact lookup
- **Auto-answer Support**: Automatic call answering (optional)

### 🎨 User Interface
- **Material Design 3**: Modern, clean interface
- **Real-time Status Display**: See what Vicky is doing
- **Activity Logs**: Complete history of commands and actions
- **Log Export**: Save logs for analysis
- **Dark Mode Ready**: Easy on the eyes

### 🔧 Advanced Features
- **Foreground Service**: Reliable background operation
- **Notification Listener Service**: Deep system integration
- **Broadcast Receivers**: Call and SMS event handling
- **Text-to-Speech Feedback**: Spoken confirmation of actions
- **Error Handling**: Graceful failure recovery

---

## 📊 Comparison with Other Assistants

| Feature | Vicky AI | Google Assistant | Amazon Alexa | Apple Siri |
|---------|----------|-----------------|--------------|------------|
| **Offline Mode** | ✅ Full Functionality | ❌ Limited | ❌ No | ❌ No |
| **Privacy** | ✅ 100% Local | ⚠️ Cloud-based | ⚠️ Cloud-based | ⚠️ Cloud-based |
| **Open Source** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Customizable** | ✅ Fully | ❌ No | ❌ Limited | ❌ No |
| **Data Collection** | ✅ None | ❌ Extensive | ❌ Extensive | ❌ Extensive |
| **Battery Impact** | ✅ Minimal | ⚠️ Moderate | ⚠️ Moderate | ⚠️ Moderate |
| **Internet Required** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Response Time** | ✅ Instant | ⚠️ Network-dependent | ⚠️ Network-dependent | ⚠️ Network-dependent |
| **Device Control** | ✅ Full | ✅ Full | ⚠️ Limited | ✅ Full (iOS only) |
| **Notification Reading** | ✅ Yes | ⚠️ Limited | ❌ No | ⚠️ Limited |
| **Cost** | ✅ Free | ✅ Free | ✅ Free | ✅ Free |
| **Platform** | Android | Android | Multi-platform | iOS/macOS |
| **Wake Word Custom** | ✅ Yes | ❌ No | ⚠️ Limited | ❌ No |

### 🎯 Why Vicky AI Stands Out

1. **True Offline Capability**: Unlike competitors that require constant internet, Vicky AI works 100% offline for all core functions.

2. **Zero Data Collection**: Your voice, commands, and usage patterns stay on your device. No profiling, no ad targeting, no data mining.

3. **Complete Transparency**: Open-source code means you can verify exactly what the app does and doesn't do.

4. **Customization Freedom**: Modify wake words, add custom commands, integrate new apps - the possibilities are endless.

5. **No Account Required**: No sign-up, no cloud sync, no login - install and start using immediately.

6. **Notification Intelligence**: Advanced notification management that reads and filters notifications intelligently.

---

## 📥 Installation

### Prerequisites
- Android device running Android 7.0 (API 24) or higher
- Android Studio Arctic Fox or later (for development)
- Minimum 50MB free storage space

### Method 1: Build from Source

```bash
# Clone the repository
git clone https://github.com/vikrant-project/offline-voice-assistant.git

# Navigate to project directory
cd offline-voice-assistant

# Open in Android Studio
# File -> Open -> Select the project directory

# Build and run
# Click on "Run" button or press Shift + F10
```

### Method 2: Install APK

1. Download the latest APK from the [Releases](https://github.com/vikrant-project/offline-voice-assistant/releases) page
2. Enable "Install from Unknown Sources" in your device settings
3. Open the downloaded APK file
4. Follow the installation prompts
5. Grant necessary permissions when prompted

---

## ⚙️ Setup & Configuration

### Initial Setup

1. **Launch the App**
   - Open "Vicky Voice Assistant" from your app drawer

2. **Grant Permissions**
   - The app will request necessary permissions:
     - ✅ Microphone (for voice input)
     - ✅ Phone (for call management)
     - ✅ Contacts (for contact access)
     - ✅ SMS (for message management)
     - ✅ Camera (for flashlight and camera control)
     - ✅ Notifications (for notification reading)
   - Tap "Allow" for each permission

3. **Enable Notification Access**
   - Tap on "Enable Notification Access" button
   - Find "Soul Voice Assistant" in the list
   - Toggle it ON
   - Return to the app

4. **Wait for Model Loading**
   - The voice recognition model will initialize
   - Wait for "Voice model ready!" message
   - Status will change to "Ready"

5. **Start Using**
   - Tap "Start Listening"
   - Say "Vicky" followed by your command
   - Example: "Vicky, what time is it?"

### Configuration Options

#### Notification Settings
- **Enable/Disable Reading**: Use the toggle switch in the main screen
- **App Filtering**: System and self-notifications are automatically filtered
- **Volume Control**: Adjust your media volume for notification speech

#### Voice Settings
- **Language**: Automatically tries Hindi first, falls back to English
- **Wake Word**: Currently "Vicky" (customizable in code)

---

## 📱 Usage Guide

### Basic Usage

1. **Start Listening**: Tap the "Start Listening" button
2. **Wake Word**: Say "Vicky" to activate
3. **Command**: Speak your command clearly
4. **Response**: Vicky will execute and provide audio feedback

### Best Practices

✅ **DO:**
- Speak clearly and at normal pace
- Use wake word before each command
- Keep your device in a quiet environment for best results
- Grant all requested permissions for full functionality

❌ **DON'T:**
- Rush your commands
- Use the app in very noisy environments
- Deny critical permissions (microphone, notifications)
- Expect complex natural language processing (stick to supported commands)

---

## 🗣️ Supported Commands

### Time & Date
```
"Vicky, what time is it?"
"Vicky, what's the date?"
"Vicky, what day is today?"
```

### App Control
```
"Vicky, open WhatsApp"
"Vicky, open YouTube"
"Vicky, open Instagram"
"Vicky, open Gmail"
"Vicky, open Chrome"
"Vicky, open Camera"
"Vicky, open Settings"
```

### Device Control
```
"Vicky, flashlight on"
"Vicky, flashlight off"
"Vicky, volume up"
"Vicky, volume down"
"Vicky, increase volume"
"Vicky, decrease volume"
```

### Search & Information
```
"Vicky, search for cats"
"Vicky, Google Android development"
"Vicky, what is artificial intelligence?"
"Vicky, tell me about Mars"
"Vicky, who is Albert Einstein?"
```

### Communication (Upcoming)
```
"Vicky, call [contact name]"
"Vicky, send message to [contact name]"
```

---

## 🏗️ Technical Architecture

### Core Components

#### 1. VoiceRecognitionService
- **Purpose**: Manages voice input and recognition
- **Technology**: Android SpeechRecognizer API
- **Features**:
  - Wake word detection
  - Continuous listening mode
  - Partial results processing
  - Auto-restart on error
  - Multi-variant wake word support

#### 2. CommandExecutor
- **Purpose**: Executes user commands
- **Capabilities**:
  - App launching via PackageManager
  - Hardware control (camera, flashlight)
  - Volume management via AudioManager
  - System settings access
  - Web search integration

#### 3. NotificationReaderService
- **Purpose**: Reads and manages notifications
- **Technology**: NotificationListenerService
- **Features**:
  - Real-time notification capture
  - Duplicate prevention algorithm
  - App name resolution
  - Text-to-Speech integration
  - Broadcast to main activity

#### 4. WebSearchHelper
- **Purpose**: Handles web searches and information queries
- **Integration**: Google Search, YouTube

#### 5. MainActivity
- **Purpose**: User interface and app coordination
- **Features**:
  - Material Design UI
  - Real-time status updates
  - Activity logging
  - Log export functionality
  - Settings management

### Technology Stack

- **Language**: Java
- **Min SDK**: API 24 (Android 7.0)
- **Target SDK**: API 34 (Android 14)
- **Build System**: Gradle 8.7.3
- **Architecture**: MVVM-inspired with Service-based background processing

### Key Libraries

```gradle
dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'com.google.android.material:material:1.12.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.core:core-ktx:1.13.1'
}
```

---

## 📋 Requirements

### Minimum Requirements
- **OS**: Android 7.0 (Nougat) or higher
- **RAM**: 2GB or more
- **Storage**: 50MB free space
- **Processor**: Dual-core 1.0 GHz or better
- **Microphone**: Built-in or external microphone

### Recommended Requirements
- **OS**: Android 10.0 or higher
- **RAM**: 4GB or more
- **Storage**: 100MB free space
- **Processor**: Quad-core 1.5 GHz or better
- **Google Speech Services**: Installed and updated (for enhanced offline recognition)

---

## 🔐 Permissions Explained

Vicky AI requires several permissions to function. Here's why each one is needed:

| Permission | Why It's Needed | When It's Used |
|------------|----------------|----------------|
| **RECORD_AUDIO** | To listen to voice commands | When you activate voice listening |
| **SEND_SMS** | To send text messages via voice | When using SMS commands |
| **READ_CONTACTS** | To access contact names for calls/messages | When initiating communication |
| **CAMERA** | To control flashlight and open camera | Flashlight and camera commands |
| **READ_PHONE_STATE** | To detect incoming calls | Call management features |
| **CALL_PHONE** | To initiate voice-activated calls | When making calls |
| **POST_NOTIFICATIONS** | To display app notifications | Status updates and feedback |
| **BIND_NOTIFICATION_LISTENER** | To read other app notifications | Notification reading feature |
| **INTERNET** | For web search functionality | When using search commands |

**Privacy Note**: Despite having INTERNET permission, Vicky AI works entirely offline for voice recognition. Internet is only used for optional web search features.

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

1. **Report Bugs**: Open an issue describing the bug and steps to reproduce
2. **Suggest Features**: Share your ideas in the issues section
3. **Submit Pull Requests**: Fix bugs or add features
4. **Improve Documentation**: Help us make the docs better
5. **Translate**: Add support for more languages

### Development Setup

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/offline-voice-assistant.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# Test thoroughly on multiple devices

# Commit with descriptive messages
git commit -m "Add feature: description"

# Push to your fork
git push origin feature/your-feature-name

# Open a Pull Request
```

### Code Style Guidelines

- Follow standard Java naming conventions
- Add comments for complex logic
- Include JavaDoc for public methods
- Test on Android 7.0+ devices
- Ensure backward compatibility

---

## 🔧 Troubleshooting

### Common Issues

#### Voice Recognition Not Working
**Problem**: App doesn't respond to voice commands  
**Solutions**:
- Ensure microphone permission is granted
- Check if device has Google Speech Services installed
- Test microphone in other apps
- Restart the app
- Reboot your device

#### Notification Reading Not Working
**Problem**: Notifications aren't being read aloud  
**Solutions**:
- Enable notification access in system settings
- Check if notification toggle is ON in the app
- Verify Text-to-Speech is working (test in settings)
- Reinstall the app

#### Commands Not Recognized
**Problem**: Vicky doesn't understand commands  
**Solutions**:
- Speak clearly and at normal pace
- Use exact command phrases from documentation
- Reduce background noise
- Check if wake word "Vicky" is pronounced correctly
- Wait for "Listening..." status before speaking

#### App Crashes on Startup
**Problem**: App force closes immediately  
**Solutions**:
- Clear app cache: Settings → Apps → Vicky AI → Clear Cache
- Reinstall the app
- Check Android version (must be 7.0+)
- Report the crash with logs

### Getting Help

- **GitHub Issues**: [Report a bug](https://github.com/vikrant-project/offline-voice-assistant/issues)
- **Telegram Channel**: [@soulcrack](https://t.me/soulcrack)
- **Email**: support@example.com (update with actual email)

---

## 🗺️ Roadmap

### Upcoming Features (v2.1)

- [ ] Custom wake word configuration
- [ ] Multiple language support (Spanish, French, German)
- [ ] Home automation integration (MQTT, Home Assistant)
- [ ] Reminder and alarm setting via voice
- [ ] Calendar event creation
- [ ] Note-taking functionality
- [ ] Music player controls
- [ ] Better AI-powered responses
- [ ] Offline LLM integration
- [ ] Widget support
- [ ] Tasker integration

### Long-term Vision (v3.0+)

- [ ] Conversational AI with context awareness
- [ ] Voice profiles for multiple users
- [ ] Smart home device control
- [ ] Automated routines and workflows
- [ ] Advanced NLP for natural conversations
- [ ] Plugin system for third-party extensions
- [ ] Wear OS support
- [ ] Cross-device synchronization (optional)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Vicky AI Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Contact & Support

### Connect With Us

- **GitHub**: [vikrant-project](https://github.com/vikrant-project)
- **Issues**: [Report bugs or request features](https://github.com/vikrant-project/offline-voice-assistant/issues)

### Show Your Support

If you find Vicky AI helpful, please:
- ⭐ Star this repository
- 🐛 Report bugs and suggest features
- 🔀 Fork and contribute
- 📢 Share with friends and on social media
- ☕ [Buy us a coffee](https://buymeacoffee.com/vickyai) (optional)

---

## 🙏 Acknowledgments

- Android Open Source Project for the platform
- Material Design team for UI components
- Community contributors and testers
- All users who provided valuable feedback


## 💡 Pro Tips

1. **Battery Optimization**: Disable battery optimization for Vicky AI to ensure reliable background operation
2. **Quiet Hours**: Disable notification reading during sleep hours from the toggle
3. **Custom Commands**: Edit `CommandExecutor.java` to add your own command patterns
4. **Performance**: Close other voice-based apps to prevent conflicts
5. **Updates**: Keep Google Speech Services updated for best recognition accuracy

---

<div align="center">

**Made with ❤️ by the Vicky AI Team**

*Empowering privacy-conscious users with offline voice technology*

[⬆ Back to Top](#️-offline-voice-assistant---vicky-ai)

</div>
