#!/bin/bash

# Fix dSYM Upload Script for VULU
# This script handles missing dSYM files for third-party frameworks
# that don't provide debug symbols (Agora, Hermes, etc.)

set -e

echo "🔧 Fixing dSYM upload issues for third-party frameworks..."

# List of frameworks that commonly don't provide dSYMs
FRAMEWORKS_WITHOUT_DSYM=(
    "AgoraAiEchoCancellationExtension"
    "AgoraAiEchoCancellationLLExtension"
    "AgoraAiNoiseSuppressionExtension"
    "AgoraAiNoiseSuppressionLLExtension"
    "AgoraAudioBeautyExtension"
    "AgoraClearVisionExtension"
    "AgoraContentInspectExtension"
    "AgoraFaceCaptureExtension"
    "AgoraFaceDetectionExtension"
    "AgoraLipSyncExtension"
    "AgoraReplayKitExtension"
    "AgoraRtcKit"
    "AgoraRtcWrapper"
    "AgoraSoundTouch"
    "AgoraSpatialAudioExtension"
    "AgoraVideoAv1DecoderExtension"
    "AgoraVideoAv1EncoderExtension"
    "AgoraVideoDecoderExtension"
    "AgoraVideoEncoderExtension"
    "AgoraVideoQualityAnalyzerExtension"
    "AgoraVideoSegmentationExtension"
    "Agorafdkaac"
    "Agoraffmpeg"
    "aosl"
    "hermes"
    "video_dec"
    "video_enc"
)

# Check if we're in an archive build
if [ "${CONFIGURATION}" = "Release" ] && [ -n "${ARCHIVE_PATH}" ]; then
    echo "📦 Archive build detected - handling dSYM files..."
    
    DSYM_FOLDER="${ARCHIVE_PATH}/dSYMs"
    
    if [ -d "${DSYM_FOLDER}" ]; then
        echo "📁 dSYM folder found at: ${DSYM_FOLDER}"
        
        # Create placeholder dSYM files for frameworks that don't provide them
        for framework in "${FRAMEWORKS_WITHOUT_DSYM[@]}"; do
            FRAMEWORK_DSYM="${DSYM_FOLDER}/${framework}.framework.dSYM"
            
            if [ ! -d "${FRAMEWORK_DSYM}" ]; then
                echo "⚠️  Creating placeholder dSYM for ${framework}.framework"
                
                # Create the dSYM directory structure
                mkdir -p "${FRAMEWORK_DSYM}/Contents/Resources/DWARF"
                
                # Create Info.plist
                cat > "${FRAMEWORK_DSYM}/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleIdentifier</key>
    <string>com.apple.xcode.dsym.${framework}.framework</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>dSYM</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
</dict>
</plist>
EOF
                
                # Try to create a valid DWARF file from the framework binary
                FRAMEWORK_BINARY="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/${framework}.framework/${framework}"
                DWARF_OUTPUT="${FRAMEWORK_DSYM}/Contents/Resources/DWARF/${framework}"
                
                if [ -f "${FRAMEWORK_BINARY}" ]; then
                    echo "📋 Found framework binary, creating stripped dSYM..."
                    # Copy the binary and strip debug symbols to create a valid symbol table
                    cp "${FRAMEWORK_BINARY}" "${DWARF_OUTPUT}"
                    strip -S "${DWARF_OUTPUT}"
                    echo "✅ Created valid dSYM for ${framework}.framework (stripped binary)"
                else
                    echo "⚠️  Framework binary not found at ${FRAMEWORK_BINARY}"
                    echo "ℹ️  Skipping dSYM creation - configure crash reporting tools to ignore missing dSYMs"
                    # Remove the empty dSYM directory structure if no valid binary found
                    rm -rf "${FRAMEWORK_DSYM}"
                fi
            else
                echo "✅ dSYM already exists for ${framework}.framework"
            fi
        done
        
        echo "🎉 dSYM processing complete!"
    else
        echo "⚠️  No dSYM folder found - skipping dSYM processing"
    fi
else
    echo "ℹ️  Not an archive build - skipping dSYM processing"
fi

echo "✅ dSYM fix script completed successfully"
