import { useEffect, useRef, useState } from "react";

// ─── Shared AudioContext singleton ────────────────────────────────────────────
let _ctx = null;
let _ctxUnlocked = false;
let _audioBufferCache = null; // Cached decoded audio buffer for custom ringtone

const getAudioCtx = () => {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("🔔 [Audio] AudioContext not supported:", e.message);
            return null;
        }
    }
    return _ctx;
};

const unlockAudioCtx = () => {
    if (_ctxUnlocked) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
        ctx.resume()
            .then(() => {
                _ctxUnlocked = true;
                console.log("🔔 [Audio] AudioContext unlocked ✅");
            })
            .catch((e) => console.warn("🔔 [Audio] resume() failed:", e.message));
    } else {
        _ctxUnlocked = true;
    }
};

// Install global unlock listeners at module load time
if (typeof window !== "undefined") {
    const UNLOCK_EVENTS = ["click", "keydown", "keyup", "pointerdown", "touchstart", "mousedown"];
    UNLOCK_EVENTS.forEach((evt) =>
        window.addEventListener(evt, unlockAudioCtx, { passive: true, capture: true }),
    );
}

const RINGTONE_URL = "/sounds/ringtone.mp3";
const RINGBACK_URL = "/sounds/ringback.mp3"; // Optional: sound for outgoing calls

const loadRingtoneBuffer = async () => {
    if (_audioBufferCache) return _audioBufferCache;

    const ctx = getAudioCtx();
    if (!ctx) return null;

    try {
        // Use absolute URL to avoid issues with nested routes
        const absoluteRingtoneUrl = new URL(RINGTONE_URL, window.location.origin).href;
        console.log("🔔 [Ringtone] Fetching ringtone file:", absoluteRingtoneUrl);
        
        const response = await fetch(absoluteRingtoneUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} — file not found at ${absoluteRingtoneUrl}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        _audioBufferCache = await ctx.decodeAudioData(arrayBuffer);
        console.log(
            `🔔 [Ringtone] File decoded ✅  duration: ${_audioBufferCache.duration.toFixed(2)}s`,
        );
        return _audioBufferCache;
    } catch (err) {
        console.warn("🔔 [Ringtone] Could not load custom ringtone, falling back to oscillator tone.");
        console.warn("   Reason:", err.message);
        return null; // Falls back to built-in oscillator tone
    }
};

// Pre-load the buffer in the background as soon as the module is imported
if (typeof window !== "undefined") {
    // Defer until after the page has had at least one interaction
    // (AudioContext may need a gesture to decode on some browsers)
    const preload = () => loadRingtoneBuffer();
    window.addEventListener("click", preload, { once: true, passive: true });
    window.addEventListener("keydown", preload, { once: true, passive: true });
}

// ─── Ringtone engine using custom file ────────────────────────────────────────
const createFileRingtoneEngine = (ctx, buffer) => {
    let stopped = false;
    let sourceNode = null;
    let loopTimer = null;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);

    const playOnce = () => {
        if (stopped) return;
        sourceNode = ctx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.connect(masterGain);
        sourceNode.start();
        // Schedule next play after file finishes (loop manually for gapless control)
        loopTimer = setTimeout(playOnce, buffer.duration * 1000 + 500); // 500 ms gap between rings
    };

    const start = () => {
        console.log("🔔 [Ringtone] Engine starting... Context state:", ctx.state);
        if (ctx.state === "running") {
            playOnce();
        } else {
            console.log("🔔 [Ringtone] Context suspended, attempting to resume...");
            ctx.resume().then(() => { 
                console.log("🔔 [Ringtone] Context resumed, state:", ctx.state);
                if (!stopped) playOnce(); 
            }).catch(e => {
                console.warn("🔔 [Ringtone] Failed to resume context:", e.message);
                // Try playing anyway as a last resort
                if (!stopped) playOnce();
            });
        }
    };

    start();

    return {
        stop: () => {
            stopped = true;
            if (loopTimer) clearTimeout(loopTimer);
            try {
                const now = ctx.currentTime;
                masterGain.gain.setValueAtTime(masterGain.gain.value, now);
                masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
                setTimeout(() => {
                    try { sourceNode?.stop(); } catch (_) {}
                    try { masterGain.disconnect(); } catch (_) {}
                }, 150);
            } catch (_) {}
        },
    };
};

// ─── Fallback oscillator engine (used when no custom file is found) ───────────
const LOOP_DURATION = 3.0;

const scheduleOneBurst = (ctx, dest, startTime, duration) => {
    const envGain = ctx.createGain();
    envGain.connect(dest);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();

    osc1.frequency.value = 480;
    osc2.frequency.value = 620;
    osc1.type = "sine";
    osc2.type = "sine";
    g1.gain.value = 0.55;
    g2.gain.value = 0.35;

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(envGain);
    g2.connect(envGain);

    const fade = 0.015;
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(0.75, startTime + fade);
    envGain.gain.setValueAtTime(0.75, startTime + duration - fade);
    envGain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
};

const createOscillatorRingtoneEngine = (ctx) => {
    let stopped = false;
    let loopTimer = null;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);

    const scheduleLoop = () => {
        if (stopped) return;
        const now = ctx.currentTime;
        scheduleOneBurst(ctx, masterGain, now, 0.4);
        scheduleOneBurst(ctx, masterGain, now + 0.55, 0.4);
        loopTimer = setTimeout(scheduleLoop, (LOOP_DURATION - 0.05) * 1000);
    };

    const start = () => {
        if (ctx.state === "running") {
            scheduleLoop();
        } else {
            ctx.resume().then(() => { if (!stopped) scheduleLoop(); });
        }
    };

    start();

    return {
        stop: () => {
            stopped = true;
            if (loopTimer) clearTimeout(loopTimer);
            try {
                const now = ctx.currentTime;
                masterGain.gain.cancelScheduledValues(now);
                masterGain.gain.setValueAtTime(masterGain.gain.value, now);
                masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
                setTimeout(() => { try { masterGain.disconnect(); } catch (_) {} }, 200);
            } catch (_) {}
        },
    };
};

// ─── Create engine: prefer file, fall back to oscillator ─────────────────────
const createRingtoneEngine = async (ctx) => {
    try {
        const buffer = await loadRingtoneBuffer();
        if (buffer) {
            console.log("🔔 [Ringtone] Using custom file via Web Audio API:", RINGTONE_URL);
            return createFileRingtoneEngine(ctx, buffer);
        }
    } catch (e) {
        console.warn("🔔 [Ringtone] Web Audio engine failed, will try fallback if possible", e.message);
    }
    
    console.log("🔔 [Ringtone] Using built-in oscillator tone");
    return createOscillatorRingtoneEngine(ctx);
};

// ─── Fallback Audio Element Engine ──────────────────────────────────────────
const createAudioElementEngine = (url) => {
    console.log("🔔 [Ringtone] Using fallback Audio element for:", url);
    const audio = new Audio(url);
    audio.loop = true;
    
    const play = async () => {
        try {
            await audio.play();
            console.log("🔔 [Ringtone] Fallback Audio element playing ✅");
        } catch (err) {
            console.warn("🔔 [Ringtone] Fallback Audio element failed:", err.message);
        }
    };
    
    play();
    
    return {
        stop: () => {
            console.log("🔕 [Ringtone] Stopping fallback Audio element");
            audio.pause();
            audio.src = "";
            audio.load();
        }
    };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
const useCallNotification = (incomingCall, outgoingCallId, inCall) => {
    const [notificationRef, setNotificationRef] = useState(null);
    const engineRef = useRef(null);
    const fallbackEngineRef = useRef(null);

    // Request browser notification permission on first mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    // ── Ringtone & Ringback ──────────────────────────────────────────────────
    useEffect(() => {
        const isIncoming = !!incomingCall && !inCall;
        const isOutgoing = !!outgoingCallId && !incomingCall && !inCall;

        if (!isIncoming && !isOutgoing) {
            console.log("🔕 [Ringtone] No active call or call already connected — ensuring sounds are stopped");
            return;
        }

        console.log(`🔔 [Ringtone] ${isIncoming ? "Incoming" : "Outgoing"} call — starting sound`);
        let active = true;

        // Stop any leftover engines
        const stopEngines = () => {
            if (engineRef.current) {
                engineRef.current.stop();
                engineRef.current = null;
            }
            if (fallbackEngineRef.current) {
                fallbackEngineRef.current.stop();
                fallbackEngineRef.current = null;
            }
        };

        stopEngines();

        const ctx = getAudioCtx();
        if (ctx) {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }

            const getEngine = async () => {
                if (isIncoming) return createRingtoneEngine(ctx);
                return createOscillatorRingtoneEngine(ctx);
            };

            getEngine().then((engine) => {
                if (!active) {
                    engine.stop();
                    return;
                }
                engineRef.current = engine;
            }).catch(err => {
                console.error("🔔 [Ringtone] Web Audio engine failed:", err);
            });
        }

        // Always start a fallback Audio element as well (browser will often allow one even if the other is blocked)
        // Or as a backup if Web Audio fails to load
        if (isIncoming) {
            const absoluteUrl = new URL(RINGTONE_URL, window.location.origin).href;
            fallbackEngineRef.current = createAudioElementEngine(absoluteUrl);
        }

        return () => {
            active = false;
            console.log("🔕 [Ringtone] Stopping sounds");
            stopEngines();
        };
    }, [incomingCall, outgoingCallId, inCall]);

    // ── Browser Notification ──────────────────────────────────────────────────
    useEffect(() => {
        if (!incomingCall || !("Notification" in window)) return;
        if (Notification.permission !== "granted") return;

        try {
            const notification = new Notification(
                incomingCall.isGroupCall ? `👥 Group Call: ${incomingCall.groupName || "Group"}` : "📞 Incoming Call",
                {
                    body: incomingCall.isGroupCall
                        ? `${incomingCall.fromUserName || "Someone"} is calling the group...`
                        : `${incomingCall.fromUserName || "Someone"} is calling you...`,
                tag: `call-${incomingCall.callId}`,
                requireInteraction: true,
            });
            setNotificationRef(notification);

            const timeout = setTimeout(() => notification.close(), 30_000);
            return () => {
                clearTimeout(timeout);
                notification.close();
            };
        } catch (error) {
            console.error("Failed to show notification:", error);
        }
    }, [incomingCall]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (notificationRef) notificationRef.close();
            if (engineRef.current) {
                engineRef.current.stop();
                engineRef.current = null;
            }
        };
    }, [notificationRef]);

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission !== "denied") {
            try {
                const perm = await Notification.requestPermission();
                return perm === "granted";
            } catch {
                return false;
            }
        }
        return false;
    };

    return {
        isNotificationSupported: "Notification" in window,
        hasNotificationPermission:
            typeof Notification !== "undefined" && Notification.permission === "granted",
        requestNotificationPermission,
    };
};

export default useCallNotification;
