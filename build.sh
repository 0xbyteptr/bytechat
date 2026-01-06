#!/usr/bin/env bash

set -e  # stop on error
export LC_ALL=C
export LANG=C
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"
echo "=== ByteChat Release Build ==="

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Try to find Java 21 (required by Capacitor 6+)
if [ -d "$HOME/.sdkman/candidates/java/21.0.2-tem" ]; then
    export JAVA_HOME="$HOME/.sdkman/candidates/java/21.0.2-tem"
elif [ -d "$HOME/.sdkman/candidates/java/17.0.8-tem" ]; then
    export JAVA_HOME="$HOME/.sdkman/candidates/java/17.0.8-tem"
elif [ -d "/usr/lib/jvm/default" ]; then
    export JAVA_HOME="/usr/lib/jvm/default"
fi

export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_OPTS="-Dfile.encoding=UTF-8"
echo "Using Java: $(java -version 2>&1 | head -n 1)"

# Set project root
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Project dir: $PROJECT_DIR"

echo ">>> Building frontend..."
cd "$PROJECT_DIR/client"
pnpm install
pnpm build

echo ">>> Copying frontend to Capacitor..."
if [ ! -d "android" ]; then
    echo "Adding android platform..."
    npx cap add android
fi
npx cap sync android

echo ">>> Applying Android manifest patch (permissions)..."
cd "$PROJECT_DIR"
patch -p1 < android-permissions.patch || echo "Patch already applied or not needed"
cd "$PROJECT_DIR/client"

echo ">>> Building Android Debug APK..."
cd "$PROJECT_DIR/client/android"
# Ensure local.properties exists for Gradle
echo "sdk.dir=$ANDROID_HOME" > local.properties

./gradlew clean
./gradlew assembleDebug -Dfile.encoding=UTF-8

APK_PATH=$(find app/build/outputs/apk/debug/ -name "*.apk" | head -n 1)
if [ -f "$APK_PATH" ]; then
    echo "--------------------------------------------------"
    echo "✅ SUCCESS! APK created at:"
    echo "$APK_PATH"
    echo "--------------------------------------------------"
else
    echo "❌ Error: APK not found!"
    exit 1
fi

echo "=== Done ==="
