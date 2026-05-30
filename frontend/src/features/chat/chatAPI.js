import axiosInstance from "@config/axiosInstance";

const BASE_URL = "/api";

export const chatAPI = {
    // ========== CONVERSATIONS ==========
    getConversations: async (limit = 20, cursor = null) => {
        const params = { limit };
        if (cursor) params.cursor = cursor;
        return axiosInstance.get(`${BASE_URL}/conversations`, { params });
    },

    getConversationByQuery: async (userId, limit = 20, cursor = null) => {
        const params = { limit };
        if (cursor) params.cursor = cursor;
        return axiosInstance.get(`${BASE_URL}/conversations/user/${userId}`, { params });
    },

    getConversationDetails: async (conversationId) => {
        return axiosInstance.post(`${BASE_URL}/conversations/details`, {
            conversationId,
        });
    },

    createConversation: async (participantId) => {
        return axiosInstance.post(`${BASE_URL}/conversations`, {
            participantId,
            type: "1to1",
        });
    },

    createGroupConversation: async ({ name, participantIds, avatar }) => {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("participantIds", JSON.stringify(participantIds));
        if (avatar) formData.append("avatar", avatar);

        return axiosInstance.post(`${BASE_URL}/conversations/group`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    updateConversation: async (conversationId, { name, avatar }) => {
        const formData = new FormData();
        if (name) formData.append("name", name);
        if (avatar) formData.append("avatar", avatar);

        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    deleteConversation: async (conversationId) => {
        return axiosInstance.delete(`${BASE_URL}/conversations/${conversationId}`);
    },

    updateConversationSettings: async (conversationId, { isMuted, isPinned }) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/settings`, { isMuted, isPinned });
    },

    disbandGroup: async (conversationId) => {
        return axiosInstance.delete(`${BASE_URL}/conversations/${conversationId}/disband`);
    },

    updateMemberRole: async (conversationId, { memberId, role }) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/members/role`, { memberId, role });
    },

    addMembersToGroup: async (conversationId, memberIds) => {
        return axiosInstance.post(`${BASE_URL}/conversations/${conversationId}/members`, { memberIds });
    },

    removeMemberFromGroup: async (conversationId, memberId) => {
        return axiosInstance.delete(`${BASE_URL}/conversations/${conversationId}/members`, {
            data: { memberId },
        });
    },

    // ========== MESSAGES ==========
    getMessages: async (conversationId, limit = 50, cursor = null) => {
        const params = { limit };
        if (cursor) params.cursor = cursor;
        return axiosInstance.get(`${BASE_URL}/conversations/${conversationId}/messages`, { params });
    },

    sendMessage: async (
        conversationId,
        { content, type = "text", attachments = [], mentions = [], replyToId = null },
    ) => {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("type", type);
        formData.append("mentions", JSON.stringify(mentions));
        if (replyToId) formData.append("replyToId", replyToId);

        // Add file attachments
        if (attachments && attachments.length > 0) {
            attachments.forEach((file, index) => {
                formData.append(`attachments`, file);
            });
        }

        return axiosInstance.post(`${BASE_URL}/conversations/${conversationId}/messages`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    forwardMessage: async (conversationId, { originalConversationId, messageId }) => {
        return axiosInstance.post(`${BASE_URL}/conversations/${conversationId}/messages/forward`, {
            originalConversationId,
            messageId,
        });
    },

    editMessage: async (conversationId, messageId, { content }) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/messages/${messageId}`, { content });
    },

    deleteMessage: async (conversationId, messageId) => {
        return axiosInstance.delete(`${BASE_URL}/conversations/${conversationId}/messages/${messageId}`);
    },

    recallMessage: async (conversationId, messageId) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/messages/${messageId}/recall`);
    },

    markAsRead: async (conversationId, messageIds) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/messages/read`, { messageIds });
    },

    markConversationAsRead: async (conversationId) => {
        return axiosInstance.put(`${BASE_URL}/conversations/${conversationId}/read`);
    },

    // ========== USERS & PRESENCE ==========
    searchUsers: async (query, limit = 20) => {
        return axiosInstance.get(`${BASE_URL}/user/search`, {
            params: { query, limit },
        });
    },

    getUserProfile: async (userId) => {
        return axiosInstance.get(`${BASE_URL}/users/${userId}`);
    },

    updateUserStatus: async (status) => {
        return axiosInstance.put(`${BASE_URL}/users/me/status`, { status });
    },

    // ========== FILES ==========
    uploadFile: async (file, conversationId, type = "image") => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversationId);
        formData.append("type", type);

        return axiosInstance.post(`${BASE_URL}/media/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    downloadFile: async (fileId) => {
        return axiosInstance.get(`${BASE_URL}/media/download/${fileId}`, {
            responseType: "blob",
        });
    },
};
