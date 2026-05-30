import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { chatAPI } from "./chatAPI";

export const loadConversations = createAsyncThunk(
    "chat/loadConversations",
    async ({ limit = 20, cursor } = {}, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const user = state.auth.user;
            const userId = user?.sub || user?.user_id || user?.userId || user?.id;

            if (!userId) {
                return rejectWithValue("User ID not found. Please log in.");
            }

            const response = await chatAPI.getConversationByQuery(userId, limit, cursor);
            const data = response.data;

            let conversations = [];
            let hasMore = false;
            let nextCursor = null;

            if (data && data.data && data.data.conversations) {
                conversations = Array.isArray(data.data.conversations) ? data.data.conversations : [];
                hasMore = data.data.hasMore || false;
                nextCursor = data.data.nextCursor || null;
            } else if (data && data.conversations) {
                conversations = Array.isArray(data.conversations) ? data.conversations : [];
                hasMore = data.hasMore || false;
                nextCursor = data.nextCursor || null;
            } else if (data && data.data && Array.isArray(data.data)) {
                // Handle double wrapped: { data: [...] }
                conversations = data.data;
            } else if (data && data.items && Array.isArray(data.items)) {
                conversations = data.items;
            } else if (Array.isArray(data)) {
                conversations = data;
            } else {
                console.warn("⚠️ Could not extract conversations. Data structure:", {
                    data,
                    keys: Object.keys(data || {}),
                });
            }

            return {
                conversations,
                hasMore,
                cursor: nextCursor,
            };
        } catch (error) {
            console.error("❌ loadConversations error:", error);
            return rejectWithValue(error.response?.data?.message || "Failed to load conversations");
        }
    },
);

export const loadMessages = createAsyncThunk(
    "chat/loadMessages",
    async ({ conversationId, limit = 50, cursor } = {}, { rejectWithValue }) => {
        try {
            // Validate conversationId
            if (!conversationId) {
                return rejectWithValue("Conversation ID is invalid");
            }

            console.log(`📨 [loadMessages] Fetching messages for ${conversationId}`);
            const response = await chatAPI.getMessages(conversationId, limit, cursor);
            let data = response.data;

            // Handle double-wrapped response { data: { messages: [...] } }
            if (data && data.data && typeof data.data === "object") {
                data = data.data;
            }

            // Handle different API response structures
            let messages = [];
            let hasMore = false;
            let nextCursor = null;

            if (data && data.messages) {
                messages = Array.isArray(data.messages) ? data.messages : [];
                hasMore = data.hasMore || false;
                nextCursor = data.nextCursor || data.cursor || null;
            } else if (data && Array.isArray(data)) {
                messages = data;
            } else if (Array.isArray(data)) {
                messages = data;
            } else {
                console.warn("❌ Could not extract messages from response. Data structure:", Object.keys(data || {}));
            }

            console.log(`✅ [loadMessages] Success: ${messages.length} messages received`);

            return {
                conversationId,
                messages,
                hasMore,
                cursor: nextCursor,
            };
        } catch (error) {
            console.error("❌ loadMessages error:", error);

            let errorMessage = "Không thể tải tin nhắn";
            const statusCode = error?.response?.status;

            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (statusCode === 404) {
                errorMessage = "Cuộc trò chuyện không tồn tại";
            } else if (statusCode === 400) {
                errorMessage = "ID cuộc trò chuyện không hợp lệ hoặc thiếu thông tin";
            } else if (statusCode === 403) {
                errorMessage = "Bạn không có quyền truy cập cuộc trò chuyện này";
            } else if (statusCode === 500) {
                errorMessage = "Lỗi máy chủ. Vui lòng thử lại sau";
            } else if (error?.message) {
                errorMessage = error.message;
            }

            return rejectWithValue(errorMessage);
        }
    },
);

export const sendMessage = createAsyncThunk(
    "chat/sendMessage",
    async ({ conversationId, content, type = "text", files = [] }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.sendMessage(conversationId, {
                content,
                type,
                attachments: files,
            });
            // API response structure: { success: true, data: { messageId, senderId, ... } }
            const apiData = response.data;
            let messageData = apiData;

            // Extract actual message data if nested
            if (apiData && apiData.data && typeof apiData.data === "object" && apiData.data.messageId) {
                messageData = apiData.data;
            }

            console.log(
                "📤 sendMessage response - messageId:",
                messageData?.messageId,
                "senderId:",
                messageData?.senderId,
            );
            return { conversationId, message: messageData };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to send message");
        }
    },
);

export const createConversation = createAsyncThunk(
    "chat/createConversation",
    async ({ participantId }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.createConversation(participantId);
            // Extract the actual data from response
            const data = response.data;
            let conversationData;
            if (data && data.data) {
                conversationData = data.data;
            } else {
                conversationData = data;
            }

            // Ensure participantId is stored with conversation for duplicate checking
            if (conversationData && !conversationData.participantId && !conversationData.participant_id) {
                conversationData.participantId = participantId;
            }

            return conversationData;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create conversation");
        }
    },
);

export const createGroupConversation = createAsyncThunk(
    "chat/createGroupConversation",
    async ({ name, participantIds, avatar }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.createGroupConversation({
                name,
                participantIds,
                avatar,
            });
            // Unwrap the data from { success: true, data: { ... } }
            return response.data?.data || response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create group");
        }
    },
);

export const updateConversation = createAsyncThunk(
    "chat/updateConversation",
    async ({ conversationId, name, avatar }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.updateConversation(conversationId, { name, avatar });
            return { conversationId, name, avatar, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to update conversation");
        }
    },
);

export const searchUsers = createAsyncThunk("chat/searchUsers", async ({ query, limit = 20 }, { rejectWithValue }) => {
    try {
        const response = await chatAPI.searchUsers(query, limit);
        const apiData = response.data;

        // Handle API response structure: { success: true, data: {...} or [...] }
        let data = apiData;
        if (apiData && apiData.data) {
            data = apiData.data;
        }

        // Ensure data is always an array
        if (Array.isArray(data)) {
            return data;
        } else if (data && typeof data === "object") {
            // Single user object - wrap in array
            return [data];
        } else if (data && Array.isArray(data.users)) {
            return data.users;
        } else {
            return [];
        }
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to search users");
    }
});

export const markMessagesAsRead = createAsyncThunk(
    "chat/markMessagesAsRead",
    async ({ conversationId, messageIds }, { rejectWithValue }) => {
        try {
            await chatAPI.markAsRead(conversationId, messageIds);
            return { conversationId, messageIds };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to mark as read");
        }
    },
);

export const removeMessage = createAsyncThunk(
    "chat/removeMessage",
    async ({ conversationId, messageId }, { rejectWithValue }) => {
        try {
            await chatAPI.deleteMessage(conversationId, messageId);
            return { conversationId, messageId };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to delete message");
        }
    },
);

export const recallMessage = createAsyncThunk(
    "chat/recallMessage",
    async ({ conversationId, messageId }, { rejectWithValue }) => {
        try {
            await chatAPI.recallMessage(conversationId, messageId);
            return { conversationId, messageId };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to recall message");
        }
    },
);

export const deleteConversation = createAsyncThunk(
    "chat/deleteConversation",
    async (conversationId, { rejectWithValue }) => {
        try {
            if (!conversationId) {
                return rejectWithValue("Conversation ID is invalid");
            }

            const response = await chatAPI.deleteConversation(conversationId);
            return conversationId;
        } catch (error) {
            const statusCode = error?.response?.status;
            let errorMessage = "Không thể xóa cuộc trò chuyện";

            if (statusCode === 404) {
                errorMessage = "Cuộc trò chuyện không tồn tại hoặc đã bị xóa";
            } else if (statusCode === 400) {
                errorMessage = "ID cuộc trò chuyện không hợp lệ";
            } else if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error?.message) {
                errorMessage = error.message;
            }

            return rejectWithValue(errorMessage);
        }
    },
);

export const disbandGroup = createAsyncThunk("chat/disbandGroup", async (conversationId, { rejectWithValue }) => {
    try {
        await chatAPI.disbandGroup(conversationId);
        return conversationId;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to disband group");
    }
});

export const updateMemberRole = createAsyncThunk(
    "chat/updateMemberRole",
    async ({ conversationId, memberId, role }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.updateMemberRole(conversationId, { memberId, role });
            return { conversationId, memberId, role, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to update role");
        }
    },
);

export const addMembersToGroup = createAsyncThunk(
    "chat/addMembersToGroup",
    async ({ conversationId, memberIds }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.addMembersToGroup(conversationId, memberIds);
            return { conversationId, memberIds, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to add members");
        }
    },
);

export const removeMemberFromGroup = createAsyncThunk(
    "chat/removeMemberFromGroup",
    async ({ conversationId, memberId }, { rejectWithValue }) => {
        try {
            await chatAPI.removeMemberFromGroup(conversationId, memberId);
            return { conversationId, memberId };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to remove member");
        }
    },
);

export const forwardMessage = createAsyncThunk(
    "chat/forwardMessage",
    async ({ conversationId, originalConversationId, messageId }, { rejectWithValue }) => {
        try {
            const response = await chatAPI.forwardMessage(conversationId, { originalConversationId, messageId });
            return { conversationId, message: response.data.data || response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to forward message");
        }
    },
);

const initialState = {
    conversations: {
        byId: {},
        allIds: [],
        selectedId: null,
        isLoading: false,
        hasMore: true,
        cursor: null,
        error: null,
    },
    messages: {
        byConversation: {},
    },
    typing: {},
    onlineUsers: {},
    searchResults: [],
    isSearching: false,
    searchError: null,
    error: null,
    sendingMessageId: null,
};

const chatSlice = createSlice({
    name: "chat",
    initialState,

    reducers: {
        // ========== REDUCER ACTIONS ==========
        selectConversation: (state, action) => {
            state.conversations.selectedId = action.payload;
        },

        addMessage: (state, action) => {
            const { conversationId, message } = action.payload;

            if (!state.messages.byConversation[conversationId]) {
                state.messages.byConversation[conversationId] = {
                    byId: {},
                    allIds: [],
                    hasMore: true,
                    cursor: null,
                };
            }

            const conv = state.messages.byConversation[conversationId];
            if (!conv.byId[message.messageId]) {
                conv.byId[message.messageId] = message;
                conv.allIds.push(message.messageId);
            } else {
                conv.byId[message.messageId] = {
                    ...conv.byId[message.messageId],
                    ...message,
                };
            }

            // Move conversation to top when new message arrives
            const convIndex = state.conversations.allIds.indexOf(conversationId);
            if (convIndex > 0) {
                state.conversations.allIds.splice(convIndex, 1);
                state.conversations.allIds.unshift(conversationId);
            } else if (convIndex === -1) {
                state.conversations.allIds.unshift(conversationId);
            }
            // Update last message timestamp
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId].lastMessageTimestamp = Date.now();
            }
        },

        updateMessage: (state, action) => {
            const { conversationId, messageId, updates } = action.payload;
            const conv = state.messages.byConversation[conversationId];
            if (conv && conv.byId[messageId]) {
                conv.byId[messageId] = {
                    ...conv.byId[messageId],
                    ...updates,
                };
            }
        },

        deleteMessage: (state, action) => {
            const { conversationId, messageId } = action.payload;
            const conv = state.messages.byConversation[conversationId];
            if (conv && conv.byId[messageId]) {
                conv.byId[messageId].isDeleted = true;
            }
        },

        setTyping: (state, action) => {
            const { conversationId, users } = action.payload;
            state.typing[conversationId] = users || [];
        },

        setUserOnline: (state, action) => {
            const { userId, status, lastSeen } = action.payload;
            state.onlineUsers[userId] = { status, lastSeen };
        },

        updateConversationList: (state, action) => {
            const { conversationId, updates } = action.payload;
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId] = {
                    ...state.conversations.byId[conversationId],
                    ...updates,
                };
            }
        },

        updateMemberInConversation: (state, action) => {
            const { conversationId, memberId, updates } = action.payload;
            const conv = state.conversations.byId[conversationId];
            if (conv && Array.isArray(conv.participants)) {
                conv.participants = conv.participants.map((p) =>
                    p.user_id === memberId || p.userId === memberId ? { ...p, ...updates } : p,
                );
            }
        },

        removeMemberFromConversation: (state, action) => {
            const { conversationId, memberId } = action.payload;
            const conv = state.conversations.byId[conversationId];
            if (conv && Array.isArray(conv.participants)) {
                conv.participants = conv.participants.filter((p) => p.user_id !== memberId && p.userId !== memberId);
            }
        },

        addConversation: (state, action) => {
            const conversation = action.payload;
            state.conversations.byId[conversation.conversationId] = conversation;
            if (!state.conversations.allIds.includes(conversation.conversationId)) {
                state.conversations.allIds.unshift(conversation.conversationId);
            }
        },

        moveConversationToTop: (state, action) => {
            const conversationId = action.payload;
            const index = state.conversations.allIds.indexOf(conversationId);
            if (index > 0) {
                // Remove from current position and add to beginning
                state.conversations.allIds.splice(index, 1);
                state.conversations.allIds.unshift(conversationId);
            } else if (index === -1) {
                // If not found, add to beginning
                state.conversations.allIds.unshift(conversationId);
            }
            // Update last message timestamp
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId].lastMessageTimestamp = Date.now();
            }
        },

        clearSearchResults: (state) => {
            state.searchResults = [];
            state.searchError = null;
        },

        setSendingMessageId: (state, action) => {
            state.sendingMessageId = action.payload;
        },

        clearError: (state) => {
            state.error = null;
        },

        clearConversations: (state) => {
            state.conversations.byId = {};
            state.conversations.allIds = [];
            state.conversations.selectedId = null;
            state.conversations.cursor = null;
            console.log("🧹 Conversations cleared");
        },

        markGroupAsDisbanded: (state, action) => {
            const conversationId = action.payload;
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId].isDisbanded = true;
                state.conversations.byId[conversationId].is_active = false;
                state.conversations.byId[conversationId].isActive = false;
            }
        },

        markAsKicked: (state, action) => {
            const conversationId = action.payload;
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId].wasKicked = true;
                state.conversations.byId[conversationId].is_active = false;
                state.conversations.byId[conversationId].isActive = false;
            }
        },

        resetChatState: () => initialState,
    },

    extraReducers: (builder) => {
        // ========== LOAD CONVERSATIONS ==========
        builder
            .addCase(loadConversations.pending, (state, action) => {
                state.conversations.isLoading = true;
                state.conversations.error = null;
                // ✅ FIXED: Do NOT clear existing conversations on reload
                // This was causing newly added conversations to disappear
                // Backend will send complete list anyway, we just mark as loading
                // Only clear if we truly need a fresh start (handled in fulfilled)
            })
            .addCase(loadConversations.fulfilled, (state, action) => {
                state.conversations.isLoading = false;
                const { conversations = [], hasMore = false, cursor = null } = action.payload;

                // Safely iterate through conversations
                if (Array.isArray(conversations)) {
                    conversations.forEach((conv) => {
                        if (conv && conv.conversationId) {
                            // Normalize lastMessageTimestamp to milliseconds
                            if (conv.lastMessageTimestamp && typeof conv.lastMessageTimestamp === "string") {
                                conv.lastMessageTimestamp = new Date(conv.lastMessageTimestamp).getTime();
                            }
                            state.conversations.byId[conv.conversationId] = conv;
                            if (!state.conversations.allIds.includes(conv.conversationId)) {
                                state.conversations.allIds.push(conv.conversationId);
                            }
                        }
                    });
                }

                state.conversations.hasMore = hasMore;
                state.conversations.cursor = cursor;
            })
            .addCase(loadConversations.rejected, (state, action) => {
                state.conversations.isLoading = false;
                state.conversations.error = action.payload;
            });

        // ========== LOAD MESSAGES ==========
        builder
            .addCase(loadMessages.pending, (state) => {
                // Don't show loading for first load or pagination
            })
            .addCase(loadMessages.fulfilled, (state, action) => {
                const { conversationId, messages = [], hasMore = false, cursor = null } = action.payload;

                console.log("💾 Reducer storing messages:", { conversationId, messagesCount: messages.length });

                if (!state.messages.byConversation[conversationId]) {
                    state.messages.byConversation[conversationId] = {
                        byId: {},
                        allIds: [],
                        hasMore: true,
                        cursor: null,
                    };
                }

                const conv = state.messages.byConversation[conversationId];
                let savedCount = 0;
                if (Array.isArray(messages)) {
                    messages.forEach((msg) => {
                        if (msg && msg.messageId) {
                            if (!conv.byId[msg.messageId]) {
                                conv.byId[msg.messageId] = msg;
                                // Add to beginning for older messages (pagination)
                                conv.allIds.unshift(msg.messageId);
                                savedCount++;
                            }
                        }
                    });
                }

                conv.hasMore = hasMore;
                conv.cursor = cursor;
            })
            .addCase(loadMessages.rejected, (state, action) => {
                state.error = action.payload;
                console.error("❌ Failed to load messages in reducer:", action.payload);
            });

        // ========== SEND MESSAGE ==========
        builder
            .addCase(sendMessage.pending, (state) => {
                state.error = null;
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                const { conversationId, message } = action.payload;
                console.log("💾 Server response for sent message:", {
                    conversationId,
                    messageId: message?.messageId,
                });
                const conv = state.messages.byConversation[conversationId];
                if (conv && message?.messageId) {
                    conv.allIds = conv.allIds.filter((id) => !id.startsWith("temp-"));
                    Object.keys(conv.byId).forEach((id) => {
                        if (id.startsWith("temp-")) {
                            delete conv.byId[id];
                        }
                    });

                    if (!conv.byId[message.messageId]) {
                        conv.byId[message.messageId] = {
                            ...message,
                            status: "sent",
                        };
                        conv.allIds.push(message.messageId);
                        console.log("✅ Added real message from server. Total messages:", conv.allIds.length);
                    } else {
                        // Message already exists, update it
                        conv.byId[message.messageId] = {
                            ...conv.byId[message.messageId],
                            ...message,
                            status: "sent",
                        };
                        console.log("✅ Updated existing message");
                    }
                }

                // ✅ IMPORTANT: Ensure conversation exists in Redux before updating it
                if (!state.conversations.byId[conversationId]) {
                    console.log("⚠️ Conversation not in Redux, creating entry from message");
                    state.conversations.byId[conversationId] = {
                        conversationId,
                        type: "1to1",
                        name: "", // Will be filled when conversation is fetched
                        createdAt: message.createdAt,
                        lastMessageId: message.messageId,
                        lastMessageTimestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
                    };
                    state.conversations.allIds.unshift(conversationId);
                }

                // Update conversation with last message info
                const updatedConv = state.conversations.byId[conversationId];
                if (updatedConv) {
                    // Build lastMessage object if not present
                    updatedConv.lastMessage = {
                        messageId: message.messageId,
                        content: message.content,
                        type: message.type,
                        senderName: message.senderName,
                        senderAvatar: message.senderAvatar,
                        createdAt: message.createdAt,
                    };
                    updatedConv.lastMessageText = message.content;
                    updatedConv.lastMessageTimestamp = message.createdAt
                        ? new Date(message.createdAt).getTime()
                        : Date.now();
                    updatedConv.lastMessageId = message.messageId;
                }

                // Move conversation to top when message is sent
                const convIndex = state.conversations.allIds.indexOf(conversationId);
                if (convIndex > 0) {
                    state.conversations.allIds.splice(convIndex, 1);
                    state.conversations.allIds.unshift(conversationId);
                } else if (convIndex === -1) {
                    // Already added above
                }

                state.sendingMessageId = null;
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload;
                state.sendingMessageId = null;
            });

        // ========== CREATE CONVERSATION ==========
        builder
            .addCase(createConversation.fulfilled, (state, action) => {
                const conversation = action.payload;
                // Normalize lastMessageTimestamp to milliseconds
                if (conversation.lastMessageTimestamp && typeof conversation.lastMessageTimestamp === "string") {
                    conversation.lastMessageTimestamp = new Date(conversation.lastMessageTimestamp).getTime();
                }
                state.conversations.byId[conversation.conversationId] = conversation;
                // Only add to allIds if it doesn't already exist
                if (!state.conversations.allIds.includes(conversation.conversationId)) {
                    state.conversations.allIds.unshift(conversation.conversationId);
                }
                state.conversations.selectedId = conversation.conversationId;
            })
            .addCase(createConversation.rejected, (state, action) => {
                state.error = action.payload;
            });

        // ========== CREATE GROUP CONVERSATION ==========
        builder
            .addCase(createGroupConversation.fulfilled, (state, action) => {
                const conversation = action.payload;
                // Normalize lastMessageTimestamp to milliseconds
                if (conversation.lastMessageTimestamp && typeof conversation.lastMessageTimestamp === "string") {
                    conversation.lastMessageTimestamp = new Date(conversation.lastMessageTimestamp).getTime();
                }
                state.conversations.byId[conversation.conversationId] = conversation;
                // Only add to allIds if it doesn't already exist
                if (!state.conversations.allIds.includes(conversation.conversationId)) {
                    state.conversations.allIds.unshift(conversation.conversationId);
                }
                state.conversations.selectedId = conversation.conversationId;
            })
            .addCase(createGroupConversation.rejected, (state, action) => {
                state.error = action.payload;
            });

        // ========== UPDATE CONVERSATION ==========
        builder.addCase(updateConversation.fulfilled, (state, action) => {
            const { conversationId, name, avatar, data } = action.payload;
            if (state.conversations.byId[conversationId]) {
                if (name) state.conversations.byId[conversationId].name = name;
                if (avatar) {
                    // If the API returns the new avatar path, use it
                    const newAvatarPath = data?.data?.avatar_path || data?.avatar_path;
                    if (newAvatarPath) {
                        state.conversations.byId[conversationId].avatar_path = newAvatarPath;
                    }
                }
            }
        });

        // ========== MEMBER MANAGEMENT ==========
        builder.addCase(updateMemberRole.fulfilled, (state, action) => {
            const { conversationId, memberId, role } = action.payload;
            const conv = state.conversations.byId[conversationId];
            if (conv && Array.isArray(conv.participants)) {
                conv.participants = conv.participants.map((p) =>
                    p.user_id === memberId || p.userId === memberId ? { ...p, role } : p,
                );
            }
        });

        builder.addCase(removeMemberFromGroup.fulfilled, (state, action) => {
            const { conversationId, memberId } = action.payload;
            const conv = state.conversations.byId[conversationId];
            if (conv && Array.isArray(conv.participants)) {
                conv.participants = conv.participants.filter((p) => p.user_id !== memberId && p.userId !== memberId);
            }
        });

        builder.addCase(addMembersToGroup.fulfilled, (state, action) => {
            const { conversationId, data } = action.payload;
            const conv = state.conversations.byId[conversationId];
            // Assuming API returns updated participant list or the new participants
            // If data.participants exists, use it, otherwise we might need to fetch
            if (conv && data && (data.participants || data.data?.participants)) {
                conv.participants = data.participants || data.data.participants;
            }
        });

        // ========== SEARCH USERS ==========
        builder
            .addCase(searchUsers.pending, (state) => {
                state.isSearching = true;
                state.searchError = null;
            })
            .addCase(searchUsers.fulfilled, (state, action) => {
                state.isSearching = false;
                state.searchResults = action.payload;
            })
            .addCase(searchUsers.rejected, (state, action) => {
                state.isSearching = false;
                state.searchError = action.payload;
            });

        // ========== MARK AS READ ==========
        builder.addCase(markMessagesAsRead.fulfilled, (state, action) => {
            const { conversationId, messageIds } = action.payload;
            const conv = state.messages.byConversation[conversationId];
            if (conv) {
                messageIds.forEach((msgId) => {
                    if (conv.byId[msgId]) {
                        conv.byId[msgId].status = "seen";
                    }
                });
            }
        });

        // ========== REMOVE MESSAGE ==========
        builder.addCase(removeMessage.fulfilled, (state, action) => {
            const { conversationId, messageId } = action.payload;
            const conv = state.messages.byConversation[conversationId];
            if (conv && conv.byId[messageId]) {
                conv.byId[messageId].isDeleted = true;
            }
        });

        // ========== RECALL MESSAGE ==========
        builder.addCase(recallMessage.fulfilled, (state, action) => {
            const { conversationId, messageId } = action.payload;
            const conv = state.messages.byConversation[conversationId];
            if (conv && conv.byId[messageId]) {
                conv.byId[messageId].isRecalled = true;
            }
        });

        // ========== DELETE CONVERSATION ==========
        builder
            .addCase(deleteConversation.fulfilled, (state, action) => {
                const conversationId = action.payload;

                // Check if conversation exists before deleting
                if (!state.conversations.byId[conversationId]) {
                    console.warn("⚠️ Conversation not found in state:", conversationId);
                    return;
                }

                // Remove from byId
                delete state.conversations.byId[conversationId];
                // Remove from allIds
                state.conversations.allIds = state.conversations.allIds.filter((id) => id !== conversationId);
                // Clear selected if it was the deleted conversation
                if (state.conversations.selectedId === conversationId) {
                    state.conversations.selectedId = state.conversations.allIds[0] || null;
                }
                // Remove messages for this conversation
                delete state.messages.byConversation[conversationId];
                console.log("✅ Conversation deleted:", conversationId);
            })
            .addCase(deleteConversation.rejected, (state, action) => {
                state.error = action.payload;
                console.error("❌ Failed to delete conversation:", action.payload);
            });

        // ========== DISBAND GROUP ==========
        builder.addCase(disbandGroup.fulfilled, (state, action) => {
            const conversationId = action.payload;
            // Remove from byId
            delete state.conversations.byId[conversationId];
            // Remove from allIds
            state.conversations.allIds = state.conversations.allIds.filter((id) => id !== conversationId);
            // Clear selected if it was the disbanded conversation
            if (state.conversations.selectedId === conversationId) {
                state.conversations.selectedId = state.conversations.allIds[0] || null;
            }
            // Remove messages for this conversation
            delete state.messages.byConversation[conversationId];
        });

        // ========== FORWARD MESSAGE ==========
        builder.addCase(forwardMessage.fulfilled, (state, action) => {
            const { conversationId, message } = action.payload;
            if (!state.messages.byConversation[conversationId]) {
                state.messages.byConversation[conversationId] = {
                    byId: {},
                    allIds: [],
                    hasMore: true,
                    cursor: null,
                };
            }
            const conv = state.messages.byConversation[conversationId];
            conv.byId[message.messageId] = message;
            if (!conv.allIds.includes(message.messageId)) {
                conv.allIds.push(message.messageId);
            }

            // Update last message in conversation list
            if (state.conversations.byId[conversationId]) {
                state.conversations.byId[conversationId].lastMessage = message;
                state.conversations.byId[conversationId].lastMessageTimestamp = new Date(message.createdAt).getTime();
            }

            // Move to top
            const idx = state.conversations.allIds.indexOf(conversationId);
            if (idx > -1) {
                state.conversations.allIds.splice(idx, 1);
            }
            state.conversations.allIds.unshift(conversationId);
        });
    },
});

export const {
    selectConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    setTyping,
    setUserOnline,
    updateConversationList,
    updateMemberInConversation,
    removeMemberFromConversation,
    addConversation,
    moveConversationToTop,
    clearSearchResults,
    setSendingMessageId,
    clearError,
    clearConversations,
    markGroupAsDisbanded,
    markAsKicked,
    resetChatState,
} = chatSlice.actions;

// ========== SELECTORS ==========
export const selectConversations = (state) =>
    state.chat.conversations.allIds.map((id) => state.chat.conversations.byId[id]);

export const selectSelectedConversation = (state) => {
    const convId = state.chat.conversations.selectedId;
    return convId ? state.chat.conversations.byId[convId] : null;
};

export const selectMessages = (conversationId) => (state) => {
    const conv = state.chat.messages.byConversation[conversationId];
    if (!conv) return [];
    // Filter out undefined messages (stale IDs with no message object)
    return conv.allIds.map((id) => conv.byId[id]).filter((msg) => msg !== undefined && msg !== null);
};

export const selectTypingUsers = (conversationId) => (state) => state.chat.typing[conversationId] || [];

export const selectUserOnlineStatus = (userId) => (state) =>
    state.chat.onlineUsers[userId] || { status: "offline", lastSeen: null };

export default chatSlice.reducer;
