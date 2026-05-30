// SimplePeer shim - use the global SimplePeer loaded from CDN
// Webpack is configured to treat 'simple-peer' as an external, so it won't be bundled
// Instead, SimplePeer is loaded from CDN in index.html
/* global globalThis, window, SimplePeer */

// Ensure EventEmitter is globally available (for any fallbacks)
const eventsModule = require("events");
const EventEmitterClass = eventsModule.EventEmitter;

if (typeof global !== "undefined") {
    global.EventEmitter = EventEmitterClass;
}
if (typeof window !== "undefined") {
    window.EventEmitter = EventEmitterClass;
}
if (typeof globalThis !== "undefined") {
    globalThis.EventEmitter = EventEmitterClass;
}

let SimplePeerClass = null;

/**
 * Get SimplePeer as a Promise
 */
export function getSimplePeer() {
    // First check if SimplePeer is already loaded
    if (SimplePeerClass) {
        return Promise.resolve(SimplePeerClass);
    }

    // Check if it's available globally from the CDN
    if (typeof window !== "undefined" && window.SimplePeer) {
        SimplePeerClass = window.SimplePeer;
        console.log("✅ SimplePeer loaded from global (CDN)");
        return Promise.resolve(SimplePeerClass);
    }

    // Try requiring it (for webpack's require.resolve fallback)
    return Promise.resolve().then(() => {
        if (!SimplePeerClass) {
            try {
                const module = require("simple-peer");
                if (typeof module === "function") {
                    SimplePeerClass = module;
                } else if (typeof module.default === "function") {
                    SimplePeerClass = module.default;
                } else if (typeof window !== "undefined" && window.SimplePeer) {
                    SimplePeerClass = window.SimplePeer;
                }
            } catch (e) {
                // Ignore - will fail below
            }
        }

        if (!SimplePeerClass && typeof window !== "undefined" && window.SimplePeer) {
            SimplePeerClass = window.SimplePeer;
        }

        if (!SimplePeerClass) {
            throw new Error(
                "SimplePeer is not available. Make sure the CDN script is loaded: " +
                    "https://cdn.jsdelivr.net/npm/simple-peer@9.11.1/simplepeer.min.js",
            );
        }

        console.log("✅ SimplePeer loaded successfully");
        return SimplePeerClass;
    });
}

/**
 * Get SimplePeer synchronously
 */
export function getSimplePeerSync() {
    if (SimplePeerClass) {
        return SimplePeerClass;
    }

    if (typeof window !== "undefined" && window.SimplePeer) {
        SimplePeerClass = window.SimplePeer;
        console.log("✅ SimplePeer loaded from global (sync)");
        return SimplePeerClass;
    }

    // Try requiring it
    try {
        const module = require("simple-peer");
        if (typeof module === "function") {
            SimplePeerClass = module;
        } else if (typeof module.default === "function") {
            SimplePeerClass = module.default;
        }
    } catch (e) {
        // Ignore
    }

    if (!SimplePeerClass && typeof window !== "undefined" && window.SimplePeer) {
        SimplePeerClass = window.SimplePeer;
    }

    if (!SimplePeerClass) {
        throw new Error(
            "SimplePeer is not available. Make sure the CDN script is loaded: " +
                "https://cdn.jsdelivr.net/npm/simple-peer@9.11.1/simplepeer.min.js",
        );
    }

    return SimplePeerClass;
}

export default {
    getSimplePeer,
    getSimplePeerSync,
};
