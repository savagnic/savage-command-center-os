# SOVEREIGN AGENT SHELL — ANDROID OS REPLACEMENT GUIDE

This guide explains how to fully replace your Android shell with the Sovereign Agent Shell, turning your device into an autonomous agent node.

## Prerequisites

1. **Install Microsoft Edge Beta** from the Google Play Store (Required for specific EIP-1193 MetaMask injection and PWA install prompts).
2. **Install MetaMask Edge Extension** inside the Edge Beta browser.
3. **Install Termux** from F-Droid (The Play Store version is deprecated).

## Step 1: Install the PWA to your Home Screen

1. Open Edge Beta and navigate to the deployed Sovereign Agent Shell URL.
2. Ensure MetaMask is unlocked.
3. Wait for the `⊚ INSTALL APP` button to appear in the top right navigation.
4. Tap the button and select "Add to Home screen".
5. Launch the app directly from your Android Home Screen for the full immersive experience.

## Step 2: Configure the Termux Substrate Agent

The Sovereign Agent Shell web interface is designed to communicate with a local Termux daemon running on your device via WebSockets.

1. Open **Termux**.
2. Install Python and the WebSockets library:
   ```bash
   pkg update
   pkg install python
   pip install websockets
   ```
3. Copy the `termux_agent.py` file from this repository to your Android device (e.g., via `adb`, `curl`, or downloading it).
4. Start the Agent:
   ```bash
   python termux_agent.py
   ```
   *You should see "Listening on ws://127.0.0.1:8765..."*

## Step 3: Initialize the Link

1. Open the Sovereign Agent Shell from your home screen.
2. In the top right corner, the UI should transition from `TERMUX: DISCONNECTED` (amber) to `TERMUX: CONNECTED` (green).
3. Navigate to the **SHELL** tab.
4. You are now communicating directly with your Android OS via Termux. Try running standard bash commands like `ls`, `uname -a`, or `top`.

---
*Note: If the WebSocket connection is closed or Termux is not running, the SHELL will fall back to local browser emulation commands.*
