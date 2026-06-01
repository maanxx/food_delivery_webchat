import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import {
    addMessage,
    updateMessage,
    setTyping,
    setUserOnline,
    updateConversationList,
    moveConversationToTop,
    addConversation,
    loadConversations,
} from "@features/chat/chatSlice";
import { toast } from "react-toastify";

let socketInstance = null;

const useWebSocket = () => {
    const dispatch = useDispatch();
    const socketRef = useRef(null);
    const conversationsRef = useRef(null);

    // Get conversations data to look up user names
    const conversations = useSelector((state) => state.chat.conversations.byId);
    const currentUser = useSelector((state) => state.auth.user);
    const currentUserRef = useRef(currentUser);

    // Update refs without triggering re-mount
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

    // Get token from localStorage
    const authToken = localStorage.getItem("access_token");

    // Initialize WebSocket connection
    useEffect(() => {
        if (!authToken) return;

        // Reuse existing connection
        if (socketInstance && socketInstance.connected) {
            socketRef.current = socketInstance;
            return;
        }

        const socket = io(process.env.REACT_APP_SOCKET_URL || "http://localhost:5678", {
            auth: {
                token: authToken,
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ["websocket", "polling"],
        });

        // ========== SOCKET EVENTS ==========

        // Connection events
        socket.on("connect", () => {
            console.log("✅ WebSocket connected", { socketId: socket.id });

            // ✅ Join personal room for user so they receive conversation updates even when Sidebar is open
            const userId = currentUser?.sub || currentUser?.user_id || currentUser?.userId || currentUser?.id;
            if (userId) {
                socket.emit("join_personal_room", { userId });
                console.log(`📍 Joined personal room: user:${userId}`);
            }
        });

        socket.on("disconnect", () => {
            console.log("❌ WebSocket disconnected");
        });

        socket.on("connect_error", (error) => {
            console.error("WebSocket connection error:", error);
        });

        // Debug: log all events
        socket.onAny((event, ...args) => {
            if (event !== "connect" && event !== "disconnect") {
                console.log(`📡 Socket event: ${event}`, args);
            }
        });

        // Message events
        socket.on("new_message", (message) => {
            console.log("📨 New message from socket:", { message, senderId: message?.senderId });
            dispatch(addMessage({ conversationId: message.conversationId, message }));

            // Phát âm thanh thông báo nếu tin nhắn đến từ người khác
            const currentUserId = currentUserRef.current?.sub || currentUserRef.current?.user_id || currentUserRef.current?.userId || currentUserRef.current?.id;
            if (message.senderId && currentUserId && message.senderId !== currentUserId) {
                const audio = new Audio("https://actions.google.com/sounds/v1/water/water_drop.ogg");
                audio.volume = 0.5;
                audio.play().catch((err) => console.log("Audio play blocked by browser:", err));
            }

            // Update conversation with latest message info - build lastMessage object
            const lastMessage = {
                messageId: message.messageId,
                content: message.content,
                type: message.type,
                senderName: message.senderName,
                senderAvatar: message.senderAvatar,
                createdAt: message.createdAt,
            };

            dispatch(
                updateConversationList({
                    conversationId: message.conversationId,
                    updates: {
                        lastMessage,
                        lastMessageTimestamp: message.createdAt || new Date().toISOString(),
                        lastMessageId: message.messageId,
                        // For backward compatibility
                        lastMessageText: message.content,
                    },
                }),
            );
            // Move conversation to top of list to show the latest activity
            dispatch(moveConversationToTop(message.conversationId));
        });

        socket.on("message_read", ({ conversationId, messageIds, readBy }) => {
            console.log("👁️ Messages marked as read:", messageIds);
            messageIds.forEach((msgId) => {
                dispatch(
                    updateMessage({
                        conversationId,
                        messageId: msgId,
                        updates: {
                            status: "seen",
                            seenBy: readBy,
                        },
                    }),
                );
            });
        });

        socket.on("message_edited", ({ conversationId, messageId, content, editedAt }) => {
            dispatch(
                updateMessage({
                    conversationId,
                    messageId,
                    updates: { content, editedAt },
                }),
            );
        });

        socket.on("message_deleted", ({ conversationId, messageId }) => {
            dispatch(
                updateMessage({
                    conversationId,
                    messageId,
                    updates: { isDeleted: true },
                }),
            );
        });

        socket.on("message_recalled", ({ conversationId, messageId }) => {
            console.log("↩️ Message recalled:", { conversationId, messageId });
            dispatch(
                updateMessage({
                    conversationId,
                    messageId,
                    updates: { isRecalled: true },
                }),
            );
        });

        // Typing indicators
        socket.on("user_typing", ({ conversationId, userId, username }) => {
            // If username is provided by backend, use it. Otherwise, get it from conversation name
            let displayName = username;

            if (!displayName && conversationId && conversationsRef.current?.[conversationId]) {
                // For 1-to-1 conversations, use the conversation name as the other user's name
                displayName = conversationsRef.current[conversationId].name;
            }

            // Fallback to generic name if still undefined
            if (!displayName) {
                displayName = "User";
            }

            console.log("⌨️ User typing:", { conversationId, userId, displayName });

            dispatch(
                setTyping({
                    conversationId,
                    users: [displayName], // In real app, would accumulate multiple users
                }),
            );
        });

        socket.on("user_stop_typing", ({ conversationId }) => {
            dispatch(setTyping({ conversationId, users: [] }));
        });

        // User presence
        socket.on("user_online", ({ userId, status }) => {
            dispatch(setUserOnline({ userId, status, lastSeen: null }));
        });

        socket.on("user_offline", ({ userId, lastSeen }) => {
            dispatch(setUserOnline({ userId, status: "offline", lastSeen }));
        });

        // Conversation updates - backend sends data spread directly on the event object
        socket.on("conversation_updated", (data) => {
            const { conversationId, ...updates } = data;
            console.log("🔄 Conversation updated event received:", {
                conversationId,
                updates,
                timestamp: new Date().toLocaleTimeString(),
                hasLastMessage: !!updates.lastMessage,
            });

            if (!conversationId) {
                console.warn("⚠️ conversation_updated event missing conversationId");
                return;
            }

            // ✅ Check if conversation already exists in Redux
            const existingConversation = conversationsRef.current?.[conversationId];

            if (existingConversation) {
                // Conversation exists - just update it
                dispatch(updateConversationList({ conversationId, updates }));
                dispatch(moveConversationToTop(conversationId));
                console.log("✅ Updated existing conversation:", conversationId);
            } else {
                // ✅ Conversation doesn't exist yet - create it from event data
                console.log("📍 New conversation received, adding to Redux...");
                const newConversation = {
                    conversationId,
                    type: "1to1",
                    name: updates.lastMessage?.senderName || "Unknown User",
                    avatarPath: updates.lastMessage?.senderAvatar || null,
                    createdAt: new Date().toISOString(),
                    ...updates,
                };
                dispatch(addConversation(newConversation));
                dispatch(moveConversationToTop(conversationId));
                console.log("✅ Added new conversation to Redux:", conversationId);

                // ✅ Don't reload in background - it would clear the conversation we just added!
                // The Redux state already has the conversation with latest message info
            }
        });

        socket.on("new_conversation", (conversation) => {
            console.log("🆕 New conversation received via WebSocket:", conversation);
            dispatch(addConversation(conversation));
            dispatch(moveConversationToTop(conversation.conversationId));
        });

        socket.on("conversation:deleted", ({ conversationId }) => {
            // Handle conversation deletion
            console.log("Conversation deleted:", conversationId);
        });

        socket.on("member_added_to_new_group", (data) => {
            console.log("📍 Added to a new group conversation:", data.conversationId);
            dispatch(loadConversations());
        });

        socketInstance = socket;
        socketRef.current = socket;

        return () => {
            // Don't disconnect on unmount - keep connection alive
            // socket.disconnect();
        };
    }, [authToken, dispatch]);

    // ========== EMIT FUNCTIONS ==========

    const sendMessage = useCallback(
        ({
            conversationId,
            content,
            type = "text",
            attachments = [],
            mentions = [],
            replyToId = null,
            temporaryId,
        }) => {
            socketRef.current?.emit("message:send", {
                conversationId,
                content,
                type,
                attachments,
                mentions,
                replyToId,
                temporaryId,
            });
        },
        [],
    );

    const markAsRead = useCallback(({ conversationId, messageIds }) => {
        socketRef.current?.emit("message:read", {
            conversationId,
            messageIds,
        });
    }, []);

    const emitTyping = useCallback(({ conversationId, isTyping }) => {
        if (isTyping) {
            socketRef.current?.emit("typing", { conversationId });
        } else {
            socketRef.current?.emit("stop_typing", { conversationId });
        }
    }, []);

    const updateStatus = useCallback((status) => {
        socketRef.current?.emit("user:status", { status });
    }, []);

    const joinConversation = useCallback((conversationId) => {
        socketRef.current?.emit("join_conversation", conversationId);
    }, []);

    const leaveConversation = useCallback((conversationId) => {
        socketRef.current?.emit("leave_conversation", conversationId);
    }, []);

    const disconnectSocket = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketInstance = null;
        }
    }, []);

    return {
        socket: socketRef.current,
        isConnected: socketRef.current?.connected || false,
        joinConversation,
        leaveConversation,
        sendMessage,
        markAsRead,
        emitTyping,
        updateStatus,
        disconnect: disconnectSocket,
    };
};

export default useWebSocket;
