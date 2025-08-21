// commands/apkgen.cjs
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");

// ====== Config dasar ======
const BUILDS_DIR = path.join(process.cwd(), "apk-builds");
if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR, { recursive: true });

// Global lock agar tidak build paralel
let building = false;

// Helper: jalanin shell command
function sh(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const p = exec(cmd, { cwd, env: process.env }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        err.stdout = stdout;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
    p.stdout?.on("data", d => process.stdout.write(d));
    p.stderr?.on("data", d => process.stderr.write(d));
  });
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "app";
}

function writeFileSafe(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

// Template file Gradle (project)
const settingsGradle = (appName) => `
rootProject.name = "${appName}"
include(":app")
`.trim();

const projectBuildGradle = `
buildscript {
    repositories { google(); mavenCentral() }
    dependencies {
        classpath "com.android.tools.build:gradle:8.5.1"
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24"
    }
}

allprojects {
    repositories { google(); mavenCentral() }
}
`.trim();

const gradleProperties = `
org.gradle.jvmargs=-Xmx2g -Dkotlin.daemon.jvm.options=-Xmx1g
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`.trim();

const appBuildGradle = `
plugins {
    id "com.android.application"
    id "org.jetbrains.kotlin.android"
}

android {
    namespace "com.example.generated"
    compileSdk 34

    defaultConfig {
        applicationId "com.example.generated"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        debug {
            minifyEnabled false
            debuggable true
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation "androidx.core:core-ktx:1.13.1"
    implementation "androidx.appcompat:appcompat:1.7.0"
    implementation "com.google.android.material:material:1.12.0"
    implementation "androidx.constraintlayout:constraintlayout:2.1.4"
}
`.trim();

const manifestXml = (label) => `
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application
      android:allowBackup="true"
      android:label="${label}"
      android:icon="@mipmap/ic_launcher"
      android:roundIcon="@mipmap/ic_launcher_round"
      android:supportsRtl="true"
      android:theme="@style/Theme.Material3.DayNight.NoActionBar">
    <activity android:name=".MainActivity">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`.trim();

const mainActivityBasic = (appTitle, bodyText) => `
package com.example.generated

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    Column(
                        modifier = androidx.compose.ui.Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "${appTitle}", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                        Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        Text(text = "${bodyText.replace(/"/g, '\\"')}", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}
`.trim();

const proguardRules = `# keep things simple
`.trim();

const themesXml = `
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.Material3.DayNight.NoActionBar" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
    </style>
</resources>
`.trim();

async function genMainActivityFromAI(appTitle, spec) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const prompt = `Buatkan kode KOTLIN untuk MainActivity Android (Compose) satu file sederhana.
Judul app: "${appTitle}". Fitur ringkas: ${spec}.
HARUS: class MainActivity : ComponentActivity { onCreate setContent { ... } } – gunakan Material3, tampilkan judul dan deskripsi, boleh ada 1-2 komponen interaktif kecil bila relevan.`;
    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    let code = res.data.choices?.[0]?.message?.content || "";
    // Ambil blok kotlin bila berformat ```kotlin ... ```
    const m = code.match(/```kotlin([\\s\\S]*?)```/i);
    if (m) code = m[1].trim();
    // fallback: kalau tidak ketemu class MainActivity, anggap gagal
    if (!/class\\s+MainActivity\\b/.test(code)) return null;
    return code;
  } catch (e) {
    console.error("AI generate error:", e?.response?.data || e.message);
    return null;
  }
}

module.exports = {
  name: "apkgen",
  description: "Generate APK Android via Gradle & Android SDK. Format: .apkgen NamaApp -> deskripsi",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    if (building) {
      return sock.sendMessage(from, { text: "⏳ Masih membangun APK sebelumnya, coba sebentar lagi..." });
    }

    // Gabungkan args lalu parse "Nama -> deskripsi"
    const raw = args.join(" ");
    if (!raw.includes("->")) {
      return sock.sendMessage(from, { text: "⚠️ Format: .apkgen NamaAplikasi -> deskripsi/fitur" });
    }
    const [namePart, specPart] = raw.split("->");
    const appName = namePart.trim() || "MyApp";
    const spec = specPart.trim() || "Aplikasi sederhana";

    // Persiapan folder
    const slug = slugify(appName);
    const proj = path.join(BUILDS_DIR, `${Date.now()}-${slug}`);
    fs.mkdirSync(proj, { recursive: true });

    // Info awal
    await sock.sendMessage(from, { text: `🧱 Menyiapkan proyek *${appName}*...\n📝 Fitur: ${spec}` });

    try {
      building = true;

      // Tulis file proyek
      writeFileSafe(path.join(proj, "settings.gradle"), settingsGradle(appName));
      writeFileSafe(path.join(proj, "build.gradle"), projectBuildGradle);
      writeFileSafe(path.join(proj, "gradle.properties"), gradleProperties);
      writeFileSafe(path.join(proj, "app", "build.gradle"), appBuildGradle);
      writeFileSafe(path.join(proj, "app", "proguard-rules.pro"), proguardRules);
      writeFileSafe(path.join(proj, "app", "src", "main", "AndroidManifest.xml"), manifestXml(appName));
      writeFileSafe(path.join(proj, "app", "src", "main", "res", "values", "themes.xml"), themesXml);

      // Coba minta AI buat MainActivity; kalau gagal pakai template basic
      const aiCode = await genMainActivityFromAI(appName, spec);
      const mainActivityCode = aiCode || mainActivityBasic(appName, spec);
      writeFileSafe(path.join(proj, "app", "src", "main", "java", "com", "example", "generated", "MainActivity.kt"), mainActivityCode);

      // Gradle wrapper
      await sock.sendMessage(from, { text: "🔧 Menyiapkan Gradle wrapper..." });
      await sh("gradle wrapper", proj);

      // Build Debug (sudah ditandatangani debug)
      await sock.sendMessage(from, { text: "🏗️ Build APK (debug) sedang berjalan...\nIni bisa makan waktu beberapa menit pertama kali." });
      await sh("./gradlew assembleDebug", proj);

      const apkPath = path.join(proj, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
      if (!fs.existsSync(apkPath)) {
        throw new Error("APK tidak ditemukan setelah build.");
      }

      const stat = fs.statSync(apkPath);
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);

      await sock.sendMessage(from, { text: `✅ Build selesai.\n📦 APK: ${sizeMB} MB\n📤 Mengirim ke chat...` });
      await sock.sendMessage(from, {
        document: { url: apkPath },
        mimetype: "application/vnd.android.package-archive",
        fileName: `${slug}-debug.apk`,
        caption: `✅ ${appName} (debug)\nFitur: ${spec}`
      }, { quoted: m });

    } catch (err) {
      console.error("apkgen error:", err?.stderr || err);
      await sock.sendMessage(from, { text: `❌ Gagal build APK.\nDetail: ${err.message || err}` });
    } finally {
      building = false;
    }
  }
};
