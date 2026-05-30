import axiosInstance from "@config/axiosInstance";

const API_BASE = "/api/calls";

const callService = {
    // Initiate a call
    initiateCall: (recipientId, conversationId, callType = "voice") => {
        return axiosInstance.post(`${API_BASE}`, {
            recipientId,
            conversationId,
            callType,
        });
    },

    // Accept a call
    acceptCall: (callId) => {
        return axiosInstance.post(`${API_BASE}/${callId}/accept`);
    },

    // Reject a call
    rejectCall: (callId, reason = "user_declined") => {
        return axiosInstance.post(`${API_BASE}/${callId}/reject`, {
            reason,
        });
    },

    // End a call
    endCall: (callId) => {
        return axiosInstance.post(`${API_BASE}/${callId}/end`);
    },

    // Get call history
    getCallHistory: (conversationId, limit = 50) => {
        return axiosInstance.get(`${API_BASE}/history/${conversationId}`, {
            params: { limit },
        });
    },

    // Get active calls
    getActiveCalls: () => {
        return axiosInstance.get(`${API_BASE}/active`);
    },

    // Initiate a group call
    initiateGroupCall: (conversationId, callType = "voice", participantIds = []) => {
        return axiosInstance.post(`${API_BASE}/group`, {
            conversationId,
            callType,
            participantIds,
        });
    },

    // Add participant to group call
    addGroupCallParticipant: (callId, participantId) => {
        return axiosInstance.post(`${API_BASE}/${callId}/add-participant`, {
            participantId,
        });
    },

    // Remove participant from group call
    removeGroupCallParticipant: (callId, participantId) => {
        return axiosInstance.post(`${API_BASE}/${callId}/remove-participant`, {
            participantId,
        });
    },
};

export default callService;
