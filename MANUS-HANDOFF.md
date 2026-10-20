# Whisper P2P Android Build - Manus Handoff

This archive contains the Whisper P2P React + TypeScript + Vite project and a GitHub Actions workflow for attempting an Android debug APK build.

## Instructions for Manus AI

1. Create a NEW GitHub repository named `whisper-p2p-android` in the connected user's GitHub account.
2. Before creating it, check whether that exact repository already exists. If it exists, stop and ask the user before changing anything.
3. Extract this archive and push the PROJECT CONTENTS to the repository root. Do not upload this ZIP as the only project file and do not create an extra nested project folder.
4. Ensure the workflow is committed at exactly `.github/workflows/build-android-apk.yml`.
5. Inspect and validate the project and workflow before pushing. Preserve source code and features. Do not claim build success until the workflow has actually run successfully.
6. Trigger GitHub Actions if authorized, inspect logs, fix real errors where possible, and report the repository URL, branch, commit hash, Actions run URL, build result, and APK artifact instructions.
7. Never expose secrets or overwrite unrelated repositories.

## Important

The presence of a workflow does not guarantee the APK will build. Validate the actual package scripts, dependency lockfile, Capacitor setup, Android configuration, and WebRTC/PeerJS behavior. Clearly distinguish compilation success from real-device functional testing.
