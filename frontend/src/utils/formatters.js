/**
 * Format timestamp to HH:MM (12-hour format)
 */
export const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
};

/**
 * Format timestamp to date string
 */
export const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

/**
 * Format bytes to number like 1.5MB
 */
export const formatBytes = (bytes) => {
    return formatFileSize(bytes);
};

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "";

    const now = Date.now();
    const secondsAgo = Math.floor((now - timestamp) / 1000);

    if (secondsAgo < 60) return "Just now";
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString();
};

/**
 * Format timestamp to DateTime string
 */
export const formatDateTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * Highlight mentions in text
 */
export const highlightMentions = (text) => {
    if (!text) return "";
    return text.replace(/@(\w+)/g, "<strong>@$1</strong>");
};

/**
 * Extract mentions from text
 */
export const extractMentions = (text) => {
    if (!text) return [];
    const regex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        mentions.push(match[1]);
    }

    return mentions;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, length = 50) => {
    if (!text) return "";
    if (text.length <= length) return text;
    return text.substring(0, length) + "...";
};

/**
 * Get initials from name
 */
export const getInitials = (name) => {
    if (!name) return "?";
    return name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
};
