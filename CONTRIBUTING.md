# Contributing to Vicky AI - Offline Voice Assistant

Thank you for your interest in contributing to Vicky AI! We welcome contributions from the community to make this project better.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing](#testing)

## 📜 Code of Conduct

By participating in this project, you agree to:
- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Device information** (Android version, device model)
- **App version** you're using

**Bug Report Template:**
```markdown
**Description:**
A clear description of the bug

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. Speak command '...'
4. See error

**Expected Behavior:**
What you expected to happen

**Actual Behavior:**
What actually happened

**Environment:**
- Device: [e.g. Samsung Galaxy S21]
- Android Version: [e.g. Android 12]
- App Version: [e.g. 2.0]

**Screenshots:**
If applicable

**Additional Context:**
Any other relevant information
```

### Suggesting Features

Feature suggestions are welcome! Please provide:

- **Clear description** of the feature
- **Use case** - why is it needed?
- **Proposed implementation** (if you have ideas)
- **Alternatives considered**

**Feature Request Template:**
```markdown
**Feature Description:**
Clear and concise description of the feature

**Problem it Solves:**
What problem does this feature address?

**Proposed Solution:**
How should this feature work?

**Alternatives Considered:**
Other solutions you've thought about

**Additional Context:**
Mockups, examples, or references
```

### Contributing Code

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Make your changes**
4. **Test thoroughly**
5. **Commit your changes** (see commit guidelines below)
6. **Push to your fork** (`git push origin feature/AmazingFeature`)
7. **Open a Pull Request**

## 🛠️ Development Setup

### Prerequisites

- Android Studio Arctic Fox or later
- JDK 11 or higher
- Git
- Android SDK with API 24+ installed

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/offline-voice-assistant.git
cd offline-voice-assistant

# 2. Open in Android Studio
# File -> Open -> Select the cloned directory

# 3. Sync Gradle
# Let Android Studio download dependencies

# 4. Create a feature branch
git checkout -b feature/your-feature-name

# 5. Make your changes

# 6. Test on real device or emulator
# Build -> Build Bundle(s) / APK(s) -> Build APK

# 7. Run the app
# Run -> Run 'app'
```

### Project Structure

```
offline-voice-assistant/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/me2008/assistant/
│   │   │   │   ├── MainActivity.java
│   │   │   │   ├── VoiceRecognitionService.java
│   │   │   │   ├── CommandExecutor.java
│   │   │   │   ├── NotificationReaderService.java
│   │   │   │   ├── CallAutoAnswerService.java
│   │   │   │   ├── CallSmsReceiver.java
│   │   │   │   └── WebSearchHelper.java
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   └── build.gradle
├── build.gradle
├── settings.gradle
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

## 🔄 Pull Request Process

1. **Update Documentation**: Update README.md if you're adding features
2. **Test Thoroughly**: Test on multiple Android versions if possible
3. **Follow Coding Guidelines**: Ensure your code follows our style guide
4. **Update CHANGELOG**: Add your changes to the unreleased section
5. **Describe Your Changes**: Write a clear PR description

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Done
- [ ] Tested on Android 10
- [ ] Tested on Android 12
- [ ] Tested on Android 14
- [ ] All voice commands working
- [ ] No crashes observed

## Screenshots
If applicable

## Checklist
- [ ] My code follows the project's coding guidelines
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have tested my changes thoroughly
```

## 📝 Coding Guidelines

### Java Style Guide

#### Naming Conventions

```java
// Classes: PascalCase
public class VoiceRecognitionService { }

// Methods: camelCase
public void startListening() { }

// Variables: camelCase
private boolean isListening;

// Constants: UPPER_SNAKE_CASE
private static final String TAG = "MainActivity";
private static final int PERMISSION_REQUEST_CODE = 100;

// Package names: lowercase
package me2008.assistant;
```

#### Code Formatting

```java
// Use 4 spaces for indentation (no tabs)
public class Example {
    
    // Space after keywords
    if (condition) {
        // code
    }
    
    // Space around operators
    int result = value1 + value2;
    
    // Braces on same line
    public void method() {
        // code
    }
    
    // Line length: max 120 characters
    // Break long lines appropriately
}
```

#### Comments

```java
/**
 * JavaDoc for public methods
 * @param text The text to process
 * @return Processed result
 */
public String processCommand(String text) {
    // Single-line comment for implementation details
    String result = text.toLowerCase();
    
    /* Multi-line comment
     * for complex explanations
     */
    return result;
}
```

#### Best Practices

- **Null Safety**: Always check for null before using objects
- **Resource Management**: Close resources properly (use try-with-resources)
- **Error Handling**: Use try-catch blocks appropriately
- **Logging**: Use Log.d/i/w/e instead of System.out.println
- **Memory Leaks**: Avoid holding context references in static variables

### Android-Specific Guidelines

```java
// 1. Use context carefully
// Avoid memory leaks
private Context context; // Store application context, not activity

// 2. Handle lifecycle properly
@Override
protected void onDestroy() {
    super.onDestroy();
    // Clean up resources
}

// 3. Use Android components correctly
// Services for background work
// BroadcastReceiver for system events
// Proper permission handling

// 4. Material Design
// Follow Material Design guidelines for UI
```

## 📧 Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```bash
# Feature
feat(voice): add support for Spanish language
feat(notification): implement app-based filtering

# Bug fix
fix(flashlight): resolve crash on devices without camera
fix(tts): fix Hindi TTS initialization issue

# Documentation
docs(readme): update installation instructions
docs(contributing): add code style guidelines

# Refactor
refactor(command): simplify command processing logic

# Style
style(main): format code according to style guide

# Chore
chore(deps): update AndroidX libraries to 1.7.0
```

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] **Voice Recognition**
  - [ ] Wake word detection works
  - [ ] Commands are recognized accurately
  - [ ] Multi-language support works

- [ ] **Commands**
  - [ ] Time/date queries work
  - [ ] App launching works
  - [ ] Device controls work
  - [ ] Search functionality works

- [ ] **Notification Reading**
  - [ ] Notifications are read correctly
  - [ ] Toggle works
  - [ ] No duplicate readings

- [ ] **UI**
  - [ ] All buttons work
  - [ ] Logs display correctly
  - [ ] Status updates properly

- [ ] **Permissions**
  - [ ] All permissions requested properly
  - [ ] App handles denied permissions gracefully

### Test on Multiple Devices

If possible, test on:
- Different Android versions (7.0, 10.0, 12.0, 14.0)
- Different manufacturers (Samsung, Google, Xiaomi, etc.)
- Different screen sizes

## 📞 Getting Help

- **GitHub Issues**: For bugs and features
- **Telegram**: [@soulcrack](https://t.me/soulcrack) for community discussion
- **Email**: Open an issue for general questions

## 🎉 Recognition

Contributors will be:
- Listed in the README.md
- Mentioned in release notes
- Given credit in commit history

Thank you for contributing to Vicky AI! 🚀
