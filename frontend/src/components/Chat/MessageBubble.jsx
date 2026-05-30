import React, { useState, useEffect } from "react";
import { Avatar } from "antd";
import { EllipsisOutlined, PlayCircleOutlined, PauseCircleOutlined, CloseOutlined, ForwardOutlined } from "@ant-design/icons";
import styles from "./ChatWindow.module.css";
import { formatTime, formatFileSize } from "@utils/formatters";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";

// Add animation styles
const animationStyles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const MessageBubble = ({ message, isOwn, showAvatar, showTimestamp, onDelete, onForward, conversationId, currentUserId }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [selectedImage, setSelectedImage] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const menuButtonRef = React.useRef(null);
    const audioRef = React.useRef(null);

    // Reset audio state when message changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    }, [message?.messageId]);

    // Check if message can be recalled (within 5 minutes)
    const canRecall = () => {
        if (!message?.createdAt) return false;
        const messageTime = new Date(message.createdAt).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return now - messageTime < fiveMinutes;
    };

    // Close menu when clicking outside (must be called unconditionally before returns)
    useEffect(() => {
        if (showMenu) {
            const handleCloseMenu = (e) => {
                // Don't close if clicking the menu button
                if (menuButtonRef.current && menuButtonRef.current.contains(e.target)) {
                    return;
                }
                setShowMenu(false);
            };
            document.addEventListener("click", handleCloseMenu);
            return () => document.removeEventListener("click", handleCloseMenu);
        }
    }, [showMenu]);

    if (!message) {
        return null;
    }

    // Special rendering for system messages (centered, no bubble)
    if (message.type === "system") {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                    margin: "12px 0",
                    padding: "0 20px",
                }}
            >
                <div
                    style={{
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#8c8c8c",
                        textAlign: "center",
                        maxWidth: "80%",
                    }}
                >
                    {(() => {
                        const metadata = message.metadata || {};
                        if (metadata.action === "member_removed") {
                            const isKicked = metadata.removedMemberId === currentUserId;
                            const isKicker = metadata.adminId === currentUserId;

                            const adminName = metadata.adminName || "Admin";
                            const removedName = metadata.removedMemberName || "a member";

                            if (isKicker) {
                                return `You removed ${removedName} from the group`;
                            }
                            if (isKicked) {
                                return `You have been removed from the group by ${adminName}`;
                            }
                            return `${adminName} removed ${removedName} from the group`;
                        }
                        if (metadata.action === "member_added") {
                            const adderName = metadata.adminName || "Admin";
                            const addedName = metadata.addedMemberName || "a member";
                            return `${adderName} added ${addedName} to the group`;
                        }
                        if (metadata.action === "group_disbanded") {
                            if (isOwn) {
                                return `You have disbanded the group`;
                            }
                            return `${metadata.adminName} has disbanded the group`;
                        }
                        return message.content;
                    })()}
                </div>
            </div>
        );
    }

    const getSeenStatus = () => {
        if (!message) return null;

        if (message.isRead === true || message.status === "seen") {
            return (
                <span className={styles.seen} title="Seen">
                    {/* ✓✓ */}
                </span>
            );
        }
        if (message.status === "delivered") {
            return (
                <span className={styles.delivered} title="Delivered">
                    {/* ✓ */}
                </span>
            );
        }
        return (
            <span className={styles.sent} title="Sent">
                {/* ✓ */}
            </span>
        );
    };

    // Helper function to check if attachment is audio
    const isAudioFile = (fileUrl, fileName) => {
        if (!fileUrl && !fileName) return false;
        const audioExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".webm", ".aac", ".flac"];
        const fileNameLower = (fileName || "").toLowerCase();
        const uriPart = (fileUrl || "").toLowerCase();
        return audioExtensions.some((ext) => fileNameLower.endsWith(ext) || uriPart.includes(ext));
    };

    const renderContent = () => {
        if (!message || !message.type) {
            return <p className={styles.messageText}>{message?.content || "Message"}</p>;
        }

        let effectiveType = message.type;
        if (effectiveType === "forward") {
            if (Array.isArray(message.attachments) && message.attachments.length > 0) {
                const firstAtt = message.attachments[0];
                if (isAudioFile(firstAtt?.fileUrl, firstAtt?.fileName)) {
                    effectiveType = "voice";
                } else if (
                    firstAtt?.fileUrl?.match(/\.(jpeg|jpg|gif|png|webp|heic)$/i) || 
                    firstAtt?.fileName?.match(/\.(jpeg|jpg|gif|png|webp|heic)$/i) ||
                    firstAtt?.type?.startsWith("image")
                ) {
                    effectiveType = "image";
                } else {
                    effectiveType = "file";
                }
            } else {
                effectiveType = "text";
            }
        }

        // Check if this should be treated as voice even if type is 'file'
        const hasVoiceAttachment =
            Array.isArray(message.attachments) &&
            message.attachments.length > 0 &&
            isAudioFile(message.attachments[0].fileUrl, message.attachments[0].fileName);

        // If type is file but it's audio, treat as voice
        if ((effectiveType === "file" || message.type === "file") && hasVoiceAttachment) {
            const formatAudioTime = (seconds) => {
                if (!seconds || isNaN(seconds)) return "0:00";
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
            };

            return (
                <div>
                    {message.attachments[0] && (
                        <div style={{ width: "280px", marginBottom: "4px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px",
                                    backgroundColor: isOwn ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                                    borderRadius: "8px",
                                }}
                            >
                                <button
                                    onClick={() => {
                                        if (audioRef.current && audioRef.current.src) {
                                            if (isPlaying) {
                                                audioRef.current.pause();
                                                setIsPlaying(false);
                                            } else {
                                                audioRef.current.play().catch((err) => {
                                                    console.error("Playback error:", err);
                                                    setIsPlaying(false);
                                                });
                                                setIsPlaying(true);
                                            }
                                        } else {
                                            console.warn("Audio element or source not available");
                                        }
                                    }}
                                    style={{
                                        padding: "6px 10px",
                                        background: isOwn ? "#ffffff" : "#1890ff",
                                        color: isOwn ? "#1890ff" : "#ffffff",
                                        border: "none",
                                        borderRadius: "50%",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        transition: "all 0.3s",
                                        minWidth: "36px",
                                        height: "36px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.opacity = "0.8";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.opacity = "1";
                                    }}
                                    title={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? (
                                        <PauseCircleOutlined style={{ fontSize: "18px" }} />
                                    ) : (
                                        <PlayCircleOutlined style={{ fontSize: "18px" }} />
                                    )}
                                </button>

                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={currentTime}
                                        onChange={(e) => {
                                            const newTime = parseFloat(e.target.value);
                                            setCurrentTime(newTime);
                                            if (audioRef.current) {
                                                audioRef.current.currentTime = newTime;
                                            }
                                        }}
                                        style={{
                                            width: "100%",
                                            height: "4px",
                                            borderRadius: "2px",
                                            background: `linear-gradient(to right, ${isOwn ? "#ffffff" : "#1890ff"} 0%, ${isOwn ? "#ffffff" : "#1890ff"} ${duration ? (currentTime / duration) * 100 : 0}%, ${isOwn ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"} ${duration ? (currentTime / duration) * 100 : 0}%, ${isOwn ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"} 100%)`,
                                            cursor: "pointer",
                                            WebkitAppearance: "none",
                                            appearance: "none",
                                        }}
                                        onMouseDown={(e) => {
                                            if (audioRef.current) {
                                                audioRef.current.pause();
                                            }
                                        }}
                                        onMouseUp={() => {
                                            if (audioRef.current && isPlaying) {
                                                audioRef.current.play();
                                            }
                                        }}
                                    />
                                    <style>{`
                                        input[type="range"]::-webkit-slider-thumb {
                                            -webkit-appearance: none;
                                            appearance: none;
                                            width: 12px;
                                            height: 12px;
                                            border-radius: 50%;
                                            background: ${isOwn ? "#ffffff" : "#1890ff"};
                                            cursor: pointer;
                                            box-shadow: 0 0 2px rgba(0,0,0,0.3);
                                        }
                                        input[type="range"]::-moz-range-thumb {
                                            width: 12px;
                                            height: 12px;
                                            border-radius: 50%;
                                            background: ${isOwn ? "#ffffff" : "#1890ff"};
                                            cursor: pointer;
                                            border: none;
                                            box-shadow: 0 0 2px rgba(0,0,0,0.3);
                                        }
                                    `}</style>

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            fontSize: "11px",
                                            opacity: 0.8,
                                        }}
                                    >
                                        <span>{formatAudioTime(currentTime)}</span>
                                        <span>{formatAudioTime(duration)}</span>
                                    </div>
                                </div>

                                {message.attachments[0]?.fileUrl && (
                                    <audio
                                        ref={audioRef}
                                        src={message.attachments[0].fileUrl}
                                        onEnded={() => setIsPlaying(false)}
                                        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                                        onLoadedMetadata={(e) => setDuration(e.target.duration)}
                                        onError={(e) => {
                                            console.error("Audio loading error:", e);
                                            setIsPlaying(false);
                                        }}
                                        style={{ display: "none" }}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    {message.content && <p className={styles.messageText}>{message.content}</p>}
                </div>
            );
        }

        switch (effectiveType) {
            case "text":
                return <p className={styles.messageText}>{message.content || ""}</p>;

            case "image":
                return (
                    <div style={{ maxWidth: "360px" }}>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: (() => {
                                    const count = message.attachments?.length || 0;
                                    if (count === 1) return "1fr";
                                    if (count === 2) return "repeat(2, 1fr)";
                                    if (count === 4) return "repeat(2, 1fr)";
                                    return "repeat(3, 1fr)";
                                })(),
                                gap: "6px",
                                marginBottom: message.content ? "8px" : "0",
                            }}
                        >
                            {Array.isArray(message.attachments) &&
                                message.attachments.map((att) => (
                                    <div
                                        key={att?.fileId}
                                        style={{
                                            overflow: "hidden",
                                            borderRadius: "8px",
                                            aspectRatio: "1",
                                            backgroundColor: "#f0f0f0",
                                        }}
                                    >
                                        <img
                                            src={att?.fileUrl}
                                            alt={att?.fileName}
                                            onClick={() => setSelectedImage(att?.fileUrl)}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                cursor: "pointer",
                                                transition: "opacity 0.2s ease",
                                                display: "block",
                                            }}
                                            onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
                                            onMouseLeave={(e) => (e.target.style.opacity = "1")}
                                        />
                                    </div>
                                ))}
                        </div>
                        {message.content && <p className={styles.messageText}>{message.content}</p>}
                    </div>
                );

            case "voice": {
                const formatAudioTime = (seconds) => {
                    if (!seconds || isNaN(seconds)) return "0:00";
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                };

                return (
                    <div>
                        {Array.isArray(message.attachments) && message.attachments[0] && (
                            <div style={{ width: "280px", marginBottom: "4px" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px",
                                        backgroundColor: isOwn ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                                        borderRadius: "8px",
                                    }}
                                >
                                    <button
                                        onClick={() => {
                                            if (audioRef.current && audioRef.current.src) {
                                                if (isPlaying) {
                                                    audioRef.current.pause();
                                                    setIsPlaying(false);
                                                } else {
                                                    audioRef.current.play().catch((err) => {
                                                        console.error("Playback error:", err);
                                                        setIsPlaying(false);
                                                    });
                                                    setIsPlaying(true);
                                                }
                                            } else {
                                                console.warn("Audio element or source not available");
                                            }
                                        }}
                                        style={{
                                            padding: "6px 10px",
                                            background: isOwn ? "#ffffff" : "#1890ff",
                                            color: isOwn ? "#1890ff" : "#ffffff",
                                            border: "none",
                                            borderRadius: "50%",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            transition: "all 0.3s",
                                            minWidth: "36px",
                                            height: "36px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.opacity = "0.8";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.opacity = "1";
                                        }}
                                        title={isPlaying ? "Pause" : "Play"}
                                    >
                                        {isPlaying ? (
                                            <PauseCircleOutlined style={{ fontSize: "18px" }} />
                                        ) : (
                                            <PlayCircleOutlined style={{ fontSize: "18px" }} />
                                        )}
                                    </button>

                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            value={currentTime}
                                            onChange={(e) => {
                                                const newTime = parseFloat(e.target.value);
                                                setCurrentTime(newTime);
                                                if (audioRef.current) {
                                                    audioRef.current.currentTime = newTime;
                                                }
                                            }}
                                            style={{
                                                width: "100%",
                                                height: "4px",
                                                borderRadius: "2px",
                                                background: `linear-gradient(to right, ${isOwn ? "#ffffff" : "#1890ff"} 0%, ${isOwn ? "#ffffff" : "#1890ff"} ${duration ? (currentTime / duration) * 100 : 0}%, ${isOwn ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"} ${duration ? (currentTime / duration) * 100 : 0}%, ${isOwn ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"} 100%)`,
                                                cursor: "pointer",
                                                WebkitAppearance: "none",
                                                appearance: "none",
                                            }}
                                            onMouseDown={(e) => {
                                                if (audioRef.current) {
                                                    audioRef.current.pause();
                                                }
                                            }}
                                            onMouseUp={() => {
                                                if (audioRef.current && isPlaying) {
                                                    audioRef.current.play();
                                                }
                                            }}
                                        />
                                        <style>{`
                                            input[type="range"]::-webkit-slider-thumb {
                                                -webkit-appearance: none;
                                                appearance: none;
                                                width: 12px;
                                                height: 12px;
                                                border-radius: 50%;
                                                background: ${isOwn ? "#ffffff" : "#1890ff"};
                                                cursor: pointer;
                                                box-shadow: 0 0 2px rgba(0,0,0,0.3);
                                            }
                                            input[type="range"]::-moz-range-thumb {
                                                width: 12px;
                                                height: 12px;
                                                border-radius: 50%;
                                                background: ${isOwn ? "#ffffff" : "#1890ff"};
                                                cursor: pointer;
                                                border: none;
                                                box-shadow: 0 0 2px rgba(0,0,0,0.3);
                                            }
                                        `}</style>

                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                fontSize: "11px",
                                                opacity: 0.8,
                                            }}
                                        >
                                            <span>{formatAudioTime(currentTime)}</span>
                                            <span>{formatAudioTime(duration)}</span>
                                        </div>
                                    </div>

                                    {message.attachments[0]?.fileUrl && (
                                        <audio
                                            ref={audioRef}
                                            src={message.attachments[0].fileUrl}
                                            onEnded={() => setIsPlaying(false)}
                                            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                                            onLoadedMetadata={(e) => setDuration(e.target.duration)}
                                            onError={(e) => {
                                                console.error("Audio loading error:", e);
                                                setIsPlaying(false);
                                            }}
                                            style={{ display: "none" }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                        {message.content && <p className={styles.messageText}>{message.content}</p>}
                    </div>
                );
            }

            case "file":
                return (
                    <div>
                        {Array.isArray(message.attachments) &&
                            message.attachments
                                .filter((att) => !isAudioFile(att.fileUrl, att.fileName))
                                .map((att) => (
                                    <a
                                        key={att?.fileId}
                                        href={att?.fileUrl}
                                        download={att?.fileName}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "8px",
                                            backgroundColor: "rgba(0, 0, 0, 0.1)",
                                            borderRadius: "6px",
                                            textDecoration: "none",
                                            color: "inherit",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 500,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {att?.fileName}
                                            </div>
                                            <div style={{ fontSize: "11px", opacity: 0.7 }}>
                                                {att?.fileSize ? formatFileSize(att.fileSize) : ""}
                                            </div>
                                        </div>
                                    </a>
                                ))}
                    </div>
                );

            case "call":
            case "system_call": {
                const callData = message.callData || message.metadata || message.call_data || {};
                const status = callData.status || callData.callStatus || "";
                const isMissed = status === "missed";
                const isRejected = status === "rejected" || status === "declined";
                const isCancelled = status === "cancelled";
                const isNegative = isMissed || isRejected || isCancelled;
                const isVideo = (callData.callType || callData.type) === "video";

                const formatDuration = (seconds) => {
                    if (!seconds || seconds <= 0) return null;
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    if (mins > 0) {
                        return `${mins}m ${secs}s`;
                    }
                    return `${secs}s`;
                };

                const durationVal = callData.duration || callData.durationSeconds || 0;
                const durationStr = formatDuration(durationVal);

                return (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px" }}>
                        <div
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: isNegative ? "#fff1f0" : "#e6f7ff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                flexShrink: 0,
                            }}
                        >
                            {isVideo ? "📹" : "📞"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "600", color: isNegative ? "#f5222d" : "inherit" }}>
                                {isVideo ? "Video Call" : "Voice Call"}
                                {isMissed ? " (Missed)" : isCancelled ? " (Cancelled)" : isRejected ? " (Rejected)" : ""}
                            </div>
                            <div style={{ fontSize: "12px", opacity: 0.7 }}>
                                {durationStr ? `Duration: ${durationStr}` : isMissed ? "You missed a call" : "No answer"}
                            </div>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    if (message.isDeleted) {
        return (
            <div className={`${styles.messageBubble} ${isOwn ? styles.own : styles.other}`}>
                <div className={styles.bubbleContent} style={{ opacity: 0.5, fontStyle: "italic" }}>
                    This message was deleted
                </div>
            </div>
        );
    }

    if (message.isRecalled) {
        return (
            <div className={`${styles.messageBubble} ${isOwn ? styles.own : styles.other}`}>
                <div className={styles.bubbleContent} style={{ opacity: 0.5, fontStyle: "italic" }}>
                    This message was recalled
                </div>
            </div>
        );
    }

    const handleContextMenu = (e) => {
        if (isOwn && !message.isDeleted && !message.isRecalled) {
            e.preventDefault();
            // No longer used - menu is shown on hover instead
        }
    };

    const handleMenuClick = (e) => {
        e.stopPropagation();
        if (menuButtonRef.current) {
            const rect = menuButtonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 5,
                left: rect.left - 140, // Position menu to the left of button
            });
        }
        setShowMenu(!showMenu);
    };

    const handleDelete = async () => {
        if (onDelete && conversationId && message.messageId) {
            try {
                await onDelete(conversationId, message.messageId, "delete");
                setShowMenu(false);
            } catch (error) {
                console.error("Failed to delete message:", error);
            }
        }
    };

    const handleRecall = async () => {
        if (onDelete && conversationId && message.messageId) {
            try {
                await onDelete(conversationId, message.messageId, "recall");
                setShowMenu(false);
            } catch (error) {
                console.error("Failed to recall message:", error);
            }
        }
    };

    return (
        <div
            className={`${styles.messageBubble} ${isOwn ? styles.own : styles.other}`}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "6px" }}
        >
            {showAvatar && !isOwn && (
                <Avatar
                    size={32}
                    src={message?.senderAvatar || null}
                    style={{
                        backgroundColor: "#1890ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "12px",
                        flexShrink: 0,
                    }}
                >
                    {!message?.senderAvatar && message?.senderName
                        ? getFirstLetterOfEachWord(message.senderName).children
                        : "U"}
                </Avatar>
            )}

            <div className={styles.bubbleContent}>
                {message.forwardedFromId && (
                    <div
                        style={{
                            fontSize: "11px",
                            opacity: 0.7,
                            marginBottom: "4px",
                            fontStyle: "italic",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                        }}
                    >
                        <ForwardOutlined style={{ fontSize: "12px" }} /> Forwarded
                    </div>
                )}
                {renderContent()}

                <div className={styles.messageFooter}>
                    {showTimestamp && message.createdAt && (
                        <span className={styles.timestamp}>{formatTime(message.createdAt)}</span>
                    )}
                    {isOwn && getSeenStatus()}
                </div>
            </div>

            {/* Menu Button - Shows on Hover */}
            {!message.isDeleted && !message.isRecalled && (
                <button
                    ref={menuButtonRef}
                    onClick={handleMenuClick}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 6px",
                        color: isHovering ? "#333" : "#666",
                        fontSize: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        order: isOwn ? -1 : 1,
                        opacity: isHovering ? 1 : 0.4,
                        transition: "opacity 0.2s ease, color 0.2s ease",
                        visibility: "visible",
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.color = "#333";
                        e.target.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.color = "#666";
                        e.target.style.opacity = isHovering ? "1" : "0.4";
                    }}
                    title="More options"
                >
                    <EllipsisOutlined />
                </button>
            )}

            {/* Context Menu */}
            {showMenu && !message.isDeleted && !message.isRecalled && (
                <div
                    style={{
                        position: "fixed",
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        backgroundColor: "white",
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        zIndex: 1000,
                        minWidth: "140px",
                        animation: "fadeIn 0.2s ease",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            if (onForward) onForward(message);
                            setShowMenu(false);
                        }}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            background: "none",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: "#1890ff",
                            borderBottom: "1px solid #f0f0f0",
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#e6f7ff")}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                    >
                        Forward
                    </button>
                    {isOwn && canRecall() && (
                        <button
                            onClick={handleRecall}
                            style={{
                                display: "block",
                                width: "100%",
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: "14px",
                                color: "#ff7a45",
                                borderBottom: "1px solid #f0f0f0",
                            }}
                            onMouseEnter={(e) => (e.target.style.backgroundColor = "#fff7e6")}
                            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                            title="Recall within 5 minutes"
                        >
                            Recall
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            background: "none",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: "#d32f2f",
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#ffebee")}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                    >
                        Delete
                    </button>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    onClick={() => setSelectedImage(null)}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        animation: "fadeIn 0.3s ease",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "relative",
                            maxWidth: "90vw",
                            maxHeight: "90vh",
                            borderRadius: "8px",
                            overflow: "hidden",
                        }}
                    >
                        <img
                            src={selectedImage}
                            alt="Preview"
                            style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                display: "block",
                            }}
                        />
                        <button
                            onClick={() => setSelectedImage(null)}
                            style={{
                                position: "absolute",
                                top: "10px",
                                right: "10px",
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "rgba(0, 0, 0, 0.6)",
                                border: "none",
                                color: "white",
                                fontSize: "24px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background-color 0.2s ease",
                            }}
                            onMouseEnter={(e) => (e.target.style.backgroundColor = "rgba(0, 0, 0, 0.8)")}
                            onMouseLeave={(e) => (e.target.style.backgroundColor = "rgba(0, 0, 0, 0.6)")}
                            title="Close"
                        >
                            <CloseOutlined style={{ fontSize: "18px" }} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageBubble;
