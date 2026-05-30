import React, { useRef } from "react";
import { useDispatch } from "react-redux";
import MessageBubble from "./MessageBubble";
import { removeMessage, recallMessage } from "@features/chat/chatSlice";

// Format date for message separator
const formatDateSeparator = (timestamp) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDateStr = messageDate.toDateString();
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    if (messageDateStr === todayStr) {
        return messageDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (messageDateStr === yesterdayStr) {
        return "Yesterday " + messageDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else {
        return messageDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: messageDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
            hour: "2-digit",
            minute: "2-digit",
        });
    }
};

// Format date label for conversation header
const formatDateLabel = (timestamp) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDateStr = messageDate.toDateString();
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    if (messageDateStr === todayStr) {
        return "Today";
    } else if (messageDateStr === yesterdayStr) {
        return "Yesterday";
    } else {
        return messageDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: messageDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
    }
};

const MessageList = ({ messages, conversationId, currentUserId, onForward }) => {
    const containerRef = useRef(null);
    const dispatch = useDispatch();

    const handleDeleteMessage = async (convId, messageId, action = "delete") => {
        try {
            // Validate inputs
            if (!convId || !messageId) {
                console.error("❌ Invalid parameters - conversationId or messageId is missing");
                return;
            }

            if (action === "recall") {
                console.log("↩️ Recalling message:", messageId);
                try {
                    await dispatch(recallMessage({ conversationId: convId, messageId })).unwrap();
                    console.log("✅ Message recalled successfully");
                } catch (recallError) {
                    // If recall fails (endpoint may not be implemented yet), fall back to delete
                    console.warn("⚠️ Recall failed, falling back to delete:", recallError?.message || recallError);
                    try {
                        await dispatch(removeMessage({ conversationId: convId, messageId })).unwrap();
                        console.log("✅ Message deleted successfully (fallback)");
                    } catch (fallbackError) {
                        console.error("❌ Both recall and delete failed:", fallbackError?.message || fallbackError);
                    }
                }
            } else {
                console.log("🗑️ Deleting message:", messageId);
                try {
                    await dispatch(removeMessage({ conversationId: convId, messageId })).unwrap();
                    console.log("✅ Message deleted successfully");
                } catch (deleteError) {
                    // Log the error but don't fail - the message will be marked as deleted in redux optimistically
                    const errorMsg = deleteError?.message || String(deleteError);
                    console.error(`⚠️ Delete request failed (${errorMsg}), but message is marked for deletion`);
                    // Still mark it as deleted optimistically even if backend fails
                    if (deleteError?.message?.includes("UpdateExpression")) {
                        console.warn("⚠️ Backend error - the message has been marked as deleted on frontend");
                    }
                }
            }
        } catch (error) {
            const errorMsg = error?.message || String(error);
            console.error(`❌ Error during ${action}:`, errorMsg);
        }
    };

    // Filter out undefined messages and ensure it's an array
    const validMessages = Array.isArray(messages) ? messages.filter((msg) => msg && msg.messageId && msg.senderId) : [];

    // Sort messages by createdAt in ascending order (oldest first)
    const sortedMessages = [...validMessages].sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
    });

    console.log("✨ MessageList - valid messages:", { validCount: sortedMessages.length, sortedMessages });
    if (sortedMessages.length > 0) {
        console.log(
            "🔎 First valid message senderId:",
            sortedMessages[0].senderId,
            "currentUserId:",
            currentUserId,
            "Match:",
            sortedMessages[0].senderId === currentUserId,
        );
    }

    const TIME_GAP_THRESHOLD = 15 * 60 * 1000; // 15 minutes

    const groupedByTimeGap = sortedMessages.reduce((groups, message, index) => {
        const lastMessage = sortedMessages[index - 1];
        const messageDate = new Date(message.createdAt).toDateString();
        const lastMessageDate = lastMessage ? new Date(lastMessage.createdAt).toDateString() : null;
        const dateChanged = messageDate !== lastMessageDate;

        const hasTimeGap =
            lastMessage &&
            new Date(message.createdAt).getTime() - new Date(lastMessage.createdAt).getTime() > TIME_GAP_THRESHOLD;
        const hasSenderChange = lastMessage && message.senderId !== lastMessage.senderId;

        const shouldCreateNewGroup = !lastMessage || hasSenderChange || hasTimeGap;

        if (shouldCreateNewGroup) {
            groups.push({
                showSeparator: hasTimeGap, // Show separator only if there's a time gap > 15 minutes
                separatorTime: hasTimeGap ? new Date(lastMessage.createdAt).getTime() : null,
                showDateLabel: dateChanged, // Show date label when date changes
                dateLabel: formatDateLabel(message.createdAt),
                messages: [message],
            });
        } else {
            groups[groups.length - 1].messages.push(message);
        }

        return groups;
    }, []);

    if (validMessages.length === 0) {
        return (
            <div ref={containerRef} style={{ width: "100%", textAlign: "center", padding: "20px", color: "#999" }}>
                <p>No messages yet. Start the conversation!</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            {groupedByTimeGap.map((group, groupIndex) => {
                const firstMessage = group?.messages?.[0];
                if (!firstMessage) return null;

                const isOwn = firstMessage.senderId === currentUserId;

                return (
                    <div key={`group-${groupIndex}`}>
                        {/* Date Label - Show at the start or when date changes */}
                        {(groupIndex === 0 || group.showDateLabel) && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    margin: "16px 0 12px 0",
                                    gap: "8px",
                                }}
                            >
                                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
                                <span
                                    style={{
                                        padding: "4px 12px",
                                        background: "#e3f2fd",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        color: "#1890ff",
                                        fontWeight: "600",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {group.dateLabel}
                                </span>
                                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
                            </div>
                        )}

                        {/* Time Separator - Show only when there's a time gap */}
                        {group.showSeparator && group.separatorTime && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    margin: "12px 0",
                                    gap: "8px",
                                }}
                            >
                                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
                                <span
                                    style={{
                                        padding: "4px 12px",
                                        background: "#f0f0f0",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        color: "#666",
                                        fontWeight: "500",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatDateSeparator(group.separatorTime)}
                                </span>
                                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
                            </div>
                        )}

                        {/* Messages */}
                        <div style={{ marginBottom: "12px" }}>
                            {group.messages.map((message, msgIndex) => (
                                <MessageBubble
                                    key={message.messageId}
                                    message={message}
                                    isOwn={isOwn}
                                    showAvatar={msgIndex === 0}
                                    showTimestamp={msgIndex === group.messages.length - 1}
                                    conversationId={conversationId}
                                    onDelete={handleDeleteMessage}
                                    onForward={onForward}
                                    currentUserId={currentUserId}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MessageList;
