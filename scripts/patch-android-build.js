const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mirrorLine = "        maven { url 'https://maven.aliyun.com/repository/google' }";
const mirrorLineNoIndent = "    maven { url 'https://maven.aliyun.com/repository/google' }";

function replaceIfExists(file, replacers) {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacers) text = text.split(from).join(to);
  fs.writeFileSync(file, text);
}

// Capacitor/Cordova subprojects have their own buildscript repositories.
// In this environment Google Maven via dl.google.com may fail; this mirror lets Gradle resolve AGP/AndroidX.
replaceIfExists(path.join(root, 'node_modules/@capacitor/android/capacitor/build.gradle'), [
  ["    repositories {\n        google()\n        mavenCentral()", `    repositories {\n${mirrorLine}\n        google()\n        mavenCentral()`],
  ["repositories {\n    google()\n    mavenCentral()", `repositories {\n${mirrorLineNoIndent}\n    google()\n    mavenCentral()`],
]);

replaceIfExists(path.join(root, 'android/capacitor-cordova-android-plugins/build.gradle'), [
  ["    repositories {\n        google()\n        mavenCentral()", `    repositories {\n${mirrorLine}\n        google()\n        mavenCentral()`],
  ["repositories {\n    google()\n    mavenCentral()", `repositories {\n${mirrorLineNoIndent}\n    google()\n    mavenCentral()`],
]);

console.log('Android build patches applied.');
