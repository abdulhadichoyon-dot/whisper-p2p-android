# Whisper P2P Android APK build (phone-only workflow)

This ZIP contains a GitHub Actions workflow that builds a debug APK in GitHub's cloud runner. It does not build the APK locally on your phone.

## Before you start
- Create a GitHub repository and upload/extract the project files into its root (the root should contain `package.json`, `src/`, `vite.config.ts`, etc.).
- Include `.github/workflows/build-android-apk.yml` in the repository.
- Keep the repository private if you do not want to publish the source code publicly.

## Build
1. Push/commit the project to the `main` branch (or `master`).
2. On GitHub, open the repository → **Actions**.
3. Select **Build Whisper P2P Android APK** → **Run workflow** if needed.
4. Wait for the workflow to finish successfully.
5. Open the completed run and download the **whisper-p2p-debug-apk** artifact.
6. Extract the downloaded artifact ZIP on your phone. Install `app-debug.apk`; if Android asks, allow installs from that browser/file manager for this one install.

## Important
- This is a debug APK for testing, not a Play Store release.
- WebRTC peer connections need internet access for signaling/ICE in many network setups. Test with two devices on different networks.
- A successful build does not guarantee peer-to-peer connectivity works. Test messaging, reconnecting, permissions, and message expiry on real devices.
- Do not share private keys or signing credentials in the repository.
