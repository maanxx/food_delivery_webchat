/**
 * Media Device Utilities
 * Helpers for detecting and managing audio/video devices
 */

// Check if browser supports WebRTC
export const isWebRTCSupported = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);
};

// Get available media devices
export const getAvailableDevices = async () => {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.warn("enumerateDevices is not supported");
            return { audioDevices: [], videoDevices: [] };
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter((device) => device.kind === "audioinput");
        const videoDevices = devices.filter((device) => device.kind === "videoinput");

        console.log("📱 Available devices:", {
            audio: audioDevices.map((d) => d.label || "Unknown"),
            video: videoDevices.map((d) => d.label || "Unknown"),
        });

        return { audioDevices, videoDevices };
    } catch (error) {
        console.error("Failed to enumerate devices:", error);
        return { audioDevices: [], videoDevices: [] };
    }
};

// Check if specific device type is available
export const hasAudioDevice = async () => {
    const { audioDevices } = await getAvailableDevices();
    return audioDevices.length > 0;
};

export const hasVideoDevice = async () => {
    const { videoDevices } = await getAvailableDevices();
    return videoDevices.length > 0;
};

// Test media permissions
export const testMediaPermissions = async (type = "audio") => {
    try {
        const constraints = type === "audio" ? { audio: true } : { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Stop the test stream - safe check for native MediaStream API
        if (typeof stream.getTracks === "function") {
            stream.getTracks().forEach((track) => {
                try {
                    track.stop();
                } catch (e) {
                    console.warn("Error stopping test stream track:", e);
                }
            });
        }

        console.log(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} permission granted`);
        return true;
    } catch (error) {
        console.warn(`❌ ${type} permission issue:`, error.name);
        return false;
    }
};

// Get device info
export const getDeviceInfo = async () => {
    return {
        webRTCSupported: isWebRTCSupported(),
        audioAvailable: await hasAudioDevice(),
        videoAvailable: await hasVideoDevice(),
        audioPermission: await testMediaPermissions("audio"),
        videoPermission: await testMediaPermissions("video"),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
    };
};

// Monitor device changes
export const onDeviceChange = (callback) => {
    if (!navigator.mediaDevices?.addEventListener) {
        console.warn("Device change monitoring not supported");
        return;
    }

    navigator.mediaDevices.addEventListener("devicechange", async () => {
        const devices = await getAvailableDevices();
        callback(devices);
    });

    return () => {
        navigator.mediaDevices.removeEventListener("devicechange", callback);
    };
};

// Get optimal media constraints
export const getOptimalConstraints = (type = "voice") => {
    const audioConstraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    };

    const videoConstraints = {
        audio: audioConstraints.audio,
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
        },
    };

    return type === "video" ? videoConstraints : audioConstraints;
};

// Check internet connectivity status
export const checkNetworkStatus = () => {
    return navigator.onLine;
};

// Monitor network changes
export const onNetworkChange = (callback) => {
    window.addEventListener("online", () => callback(true));
    window.addEventListener("offline", () => callback(false));

    return () => {
        window.removeEventListener("online", () => callback(true));
        window.removeEventListener("offline", () => callback(false));
    };
};

export default {
    isWebRTCSupported,
    getAvailableDevices,
    hasAudioDevice,
    hasVideoDevice,
    testMediaPermissions,
    getDeviceInfo,
    onDeviceChange,
    getOptimalConstraints,
    checkNetworkStatus,
    onNetworkChange,
};
