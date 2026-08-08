# Vibez Android Client (Kotlin + Jetpack Compose)

This directory contains the native Android implementation of **Vibez**, built with Kotlin, Jetpack Compose, Kotlin Coroutines & Flow, and Firebase Android SDK.

---

## 📱 Features

- **Modern Jetpack Compose UI**: Vibrant dark mode theme matching the Vibez web application.
- **Firebase Authentication**: Email and password sign-in & sign-up.
- **Real-Time Messaging**: Instant chat updates via Firestore snapshot listeners converted to Kotlin `StateFlow`.
- **AI Smart Replies**: Contextual suggestion chips powered by Kotlin background processing and AI.
- **Clean Architecture**: Built following MVVM (Model-View-ViewModel) and Repository pattern with standard Kotlin coroutines.

---

## 🚀 Setup & Build Instructions

### Prerequisites
1. **JDK 17 or higher** installed.
2. **Android Studio** (Hedgehog or newer recommended).

### Adding Firebase Configuration
1. Go to your [Firebase Console](https://console.firebase.google.com/).
2. Select your Vibez Firebase project.
3. Register an Android application with package name `com.vibez.app`.
4. Download `google-services.json` and place it in the `android/app/` directory:
   ```
   android/app/google-services.json
   ```

### Building the Project
From the repository root or inside the `android/` folder:

```bash
# Build APK
gradle assembleDebug

# Run unit tests
gradle test
```

Or simply open the `android/` folder in **Android Studio** and click **Run**.
