
let SimplePeerClass = null;

export function getSimplePeer() {
    if (SimplePeerClass) return Promise.resolve(SimplePeerClass);
    
    if (typeof window !== "undefined" && window.SimplePeer) {
        SimplePeerClass = window.SimplePeer;
        console.log("✅ SimplePeer loaded from global (CDN)");
        return Promise.resolve(SimplePeerClass);
    }
    
    throw new Error("SimplePeer is not available. Make sure the CDN script is loaded in index.html");
}

export function getSimplePeerSync() {
    if (SimplePeerClass) return SimplePeerClass;
    
    if (typeof window !== "undefined" && window.SimplePeer) {
        SimplePeerClass = window.SimplePeer;
        return SimplePeerClass;
    }
    
    throw new Error("SimplePeer is not available. Make sure the CDN script is loaded in index.html");
}

export default {
    getSimplePeer,
    getSimplePeerSync,
};
