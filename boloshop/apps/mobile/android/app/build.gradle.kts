import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Upload-key credentials, kept out of the repository. Create
// android/key.properties from key.properties.example on the machine that
// signs releases; it is gitignored, and a build without it falls back to the
// debug key so `flutter run --release` still works for everyone else.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}
val hasReleaseKey = keystorePropertiesFile.exists()

android {
    namespace = "com.boloshop.boloshop"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.boloshop.boloshop"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseKey) {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // The debug key produces an installable build but one Play will
            // not accept, which is the right trade for a contributor who only
            // wants to check performance locally.
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                logger.lifecycle(
                    "android/key.properties not found — signing the release " +
                        "build with the debug key. This artifact cannot be uploaded to Play."
                )
                signingConfigs.getByName("debug")
            }

            // R8 shrinks and obfuscates the Java/Kotlin half of the app: the
            // Flutter embedding and the plugins. Dart is compiled ahead of
            // time to a native library and is untouched by any of this.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )

            // Uploads the native symbol table with the bundle, so a crash in
            // the Dart or engine .so arrives in Play Console as a stack trace
            // rather than as hexadecimal.
            ndk {
                debugSymbolLevel = "FULL"
            }
        }
    }

    bundle {
        // Flutter carries its own localisations inside the Dart snapshot, so a
        // Play language split can strip resources the app still asks for while
        // saving almost nothing. Density and ABI splits stay on.
        language {
            enableSplit = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
