import { useDispatch, useSelector } from "react-redux";
import {
    loadConversations,
    loadMessages,
    sendMessage,
    createConversation,
    createGroupConversation,
    searchUsers,
    selectConversation,
    markMessagesAsRead,
    removeMessage,
    selectConversations,
    selectSelectedConversation,
    selectMessages,
    selectTypingUsers,
    selectUserOnlineStatus,
} from "@features/chat/chatSlice";

/**
 * Custom hook for chat functionality
 */
const useChat = () => {
    const dispatch = useDispatch();

    const conversations = useSelector(selectConversations);
    const selectedConversation = useSelector(selectSelectedConversation);
    const selectedConvId = useSelector((state) => state.chat.conversations.selectedId);
    const messages = useSelector(selectMessages(selectedConvId));
    const typingUsers = useSelector(selectTypingUsers(selectedConvId));
    const searchResults = useSelector((state) => state.chat.searchResults);
    const isLoadingConversations = useSelector((state) => state.chat.conversations.isLoading);
    const isSearching = useSelector((state) => state.chat.isSearching);
    const error = useSelector((state) => state.chat.error);

    // ========== ACTIONS ==========

    const getConversations = async (limit = 50, cursor = null) => {
        return dispatch(loadConversations({ limit, cursor })).unwrap();
    };

    const getMessages = async (conversationId, limit = 50, cursor = null) => {
        return dispatch(loadMessages({ conversationId, limit, cursor })).unwrap();
    };

    const send = async (conversationId, content, type = "text", files = []) => {
        await dispatch(sendMessage({ conversationId, content, type, files })).unwrap();
        // ✅ WebSocket conversation_updated event will handle real-time updates
        // Do NOT call loadConversations here - it clears Redux state on .pending
        return true;
    };

    const createNewConversation = async (participantId) => {
        return dispatch(createConversation({ participantId })).unwrap();
    };

    const createNewGroupConversation = async (name, participantIds, avatar) => {
        return dispatch(createGroupConversation({ name, participantIds, avatar })).unwrap();
    };

    const search = async (query, limit = 20) => {
        return dispatch(searchUsers({ query, limit })).unwrap();
    };

    const selectConv = (conversationId) => {
        dispatch(selectConversation(conversationId));
    };

    const markAsRead = async (conversationId, messageIds) => {
        return dispatch(markMessagesAsRead({ conversationId, messageIds })).unwrap();
    };

    const removeMsg = async (conversationId, messageId) => {
        return dispatch(removeMessage({ conversationId, messageId })).unwrap();
    };

    const getOnlineStatus = (userId) => {
        return useSelector(selectUserOnlineStatus(userId));
    };

    return {
        // State
        conversations,
        selectedConversation,
        selectedConvId,
        messages,
        typingUsers,
        searchResults,
        isLoadingConversations,
        isSearching,
        error,

        // Actions
        getConversations,
        getMessages,
        send,
        createNewConversation,
        createNewGroupConversation,
        search,
        selectConv,
        markAsRead,
        removeMsg,
        getOnlineStatus,
    };
};

export default useChat;
