import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { Avatar, message } from "antd";
import { InfoCircleOutlined, PhoneOutlined, SearchOutlined, VideoCameraOutlined } from "@ant-design/icons";
import styles from "./ChatWindow.module.css";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";
import useWebSocket from "@hooks/useWebSocket";

import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import EmptyChat from "./EmptyChat";
import CallWindow from "./CallWindow";
import ChatSidebar from "./ChatSidebar";
import ForwardModal from "./ForwardModal";
import GroupSettingsModal from "./GroupSettingsModal";
import AddMembersModal from "./AddMembersModal";
import GroupAvatar from "./GroupAvatar";
import {
    loadMessages,
    selectMessages,
    markMessagesAsRead,
    updateConversationList,
    updateMemberInConversation,
    removeMemberFromConversation,
    markGroupAsDisbanded,
    markAsKicked,
    loadConversations,
    addMessage,
} from "@features/chat/chatSlice";
import callService from "@services/callService";
import { useCallContext } from "@contexts/CallContext";

const ChatWindow = () => {
    const { conversationId } = useParams();
    const dispatch = useDispatch();
    const { socket, isConnected, markAsRead } = useWebSocket();
    const { callState, makeCall, makeGroupCall, acceptCall, rejectCall, endCall, toggleAudio, toggleVideo } = useCallContext();

    const messages = useSelector(selectMessages(conversationId));
    const conversation = useSelector((state) => state.chat.conversations.byId[conversationId]);
    const typingUsers = useSelector((state) => state.chat.typing[conversationId] || []);

    // Get currentUserId from Redux
    const user = useSelector((state) => state.auth.user);
    const currentUserId = user?.sub || user?.user_id || user?.userId || user?.id;

    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [isInitiatingCall, setIsInitiatingCall] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);

    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null);

    // Get recipient ID for 1-on-1 conversations
    const getRecipientId = () => {
        console.log("🔍 Getting recipient ID for conversation:", conversationId);
        console.log("📋 Full conversation object:", conversation);
        console.log("📋 Current user ID:", currentUserId);

        // Check for group conversations first - return null but don't error
        if (conversation?.type === "group" || conversation?.conversationType === "group") {
            return null;
        }

        // Try to find recipient from direct fields
        const directRecipientId =
            conversation?.recipientId ||
            conversation?.recipient_id ||
            conversation?.memberId ||
            conversation?.otherUserId ||
            conversation?.participantId;

        if (directRecipientId && directRecipientId !== currentUserId) {
            console.log("✅ Found recipient ID from direct field:", directRecipientId);
            return directRecipientId;
        }

        // Try to find recipient from members array (alternative name)
        if (conversation?.members && Array.isArray(conversation.members)) {
            const recipient = conversation.members.find((m) => (m.id || m.userId || m.user_id) !== currentUserId);
            if (recipient) {
                const recipientId = recipient.id || recipient.userId || recipient.user_id;
                console.log("✅ Found recipient from members array:", recipientId);
                return recipientId;
            }
        }

        // Try to find recipient from participants array
        if (conversation?.participants && Array.isArray(conversation.participants)) {
            const recipient = conversation.participants.find((p) => (p.id || p.userId || p.user_id) !== currentUserId);
            if (recipient) {
                const recipientId = recipient.id || recipient.userId || recipient.user_id;
                console.log("✅ Found recipient from participants:", recipientId);
                return recipientId;
            }
        }

        // Try to find recipient from messages
        if (Array.isArray(messages) && messages.length > 0) {
            const otherMessage = messages.find((msg) => msg.senderId !== currentUserId);
            if (otherMessage?.senderId) {
                console.log("✅ Found recipient from messages:", otherMessage.senderId);
                return otherMessage.senderId;
            }
        }

        // Last resort: try createdBy field
        if (conversation?.createdBy && conversation.createdBy !== currentUserId) {
            console.log("✅ Found recipient from createdBy:", conversation.createdBy);
            return conversation.createdBy;
        }

        console.error("❌ Unable to determine recipient. Conversation structure:", {
            type: conversation?.type,
            conversationType: conversation?.conversationType,
            hasRecipientFields: !!(conversation?.recipientId || conversation?.recipient_id || conversation?.memberId),
            hasParticipants: !!conversation?.participants,
            hasMembers: !!conversation?.members,
            messageCount: messages?.length || 0,
            conversationKeys: Object.keys(conversation || {}),
        });
        message.error("Unable to determine recipient. Please refresh the conversation.");
        return null;
    };

    // Load messages
    useEffect(() => {
        if (!conversationId) {
            console.warn("⚠️ No conversationId provided to ChatWindow");
            return;
        }

        console.log("📨 Loading messages for conversation:", conversationId);
        setIsLoadingMessages(true);
        setLoadError(null);
        dispatch(loadMessages({ conversationId, limit: 50 }))
            .unwrap()
            .catch((error) => {
                console.error("❌ Failed to load messages:", error);
                setLoadError(error);
            })
            .finally(() => setIsLoadingMessages(false));
    }, [conversationId, dispatch]);

    // Join conversation room
    useEffect(() => {
        if (!isConnected || !conversationId) {
            console.warn("⚠️ Cannot join conversation - isConnected:", isConnected, "conversationId:", conversationId);
            return;
        }

        console.log("✅ Joining conversation room:", conversationId);
        socket?.emit("join_conversation", conversationId);

        return () => {
            socket?.emit("leave_conversation", conversationId);
        };
    }, [conversationId, socket, isConnected]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto mark messages as read
    useEffect(() => {
        if (!isConnected || !conversationId || !messages.length) return;

        const unreadMessages = messages
            .filter((msg) => msg.senderId !== currentUserId && msg.status !== "seen")
            .map((msg) => msg.messageId);

        if (unreadMessages.length > 0) {
            setTimeout(() => {
                dispatch(markMessagesAsRead({ conversationId, messageIds: unreadMessages }));
                markAsRead({ conversationId, messageIds: unreadMessages });
            }, 500);
        }
    }, [messages, conversationId, currentUserId, isConnected, dispatch, markAsRead]);

    // Handle WebSocket events for groups
    useEffect(() => {
        if (!socket) return;

        const handleGroupDisbanded = (data) => {
            if (data.conversationId === conversationId) {
                message.warning("This group has been disbanded by the admin.");
                dispatch(markGroupAsDisbanded(conversationId));
            }
        };

        const handleMemberRoleUpdated = (data) => {
            if (data.conversationId === conversationId) {
                dispatch(
                    updateMemberInConversation({
                        conversationId,
                        memberId: data.memberId,
                        updates: { role: data.role },
                    }),
                );
                if (data.memberId === currentUserId) {
                    message.info(`Your role in this group has been updated to ${data.role}`);
                }
            }
        };

        const handleMemberAdded = (data) => {
            if (data.conversationId === conversationId) {
                // Refresh conversation list to update participant count
                dispatch(loadConversations());
            }
        };

        const handleMemberRemoved = (data) => {
            if (data.conversationId === conversationId) {
                if (data.memberId === currentUserId) {
                    message.error("You have been removed from this group.");
                    dispatch(markAsKicked(conversationId));
                } else {
                    dispatch(
                        removeMemberFromConversation({
                            conversationId,
                            memberId: data.memberId,
                        }),
                    );
                }
            }
        };

        socket.on("group_disbanded", handleGroupDisbanded);
        socket.on("member_role_updated", handleMemberRoleUpdated);
        socket.on("member_added", handleMemberAdded);
        socket.on("member_removed", handleMemberRemoved);

        return () => {
            socket.off("group_disbanded", handleGroupDisbanded);
            socket.off("member_role_updated", handleMemberRoleUpdated);
            socket.off("member_added", handleMemberAdded);
            socket.off("member_removed", handleMemberRemoved);
        };
    }, [socket, conversationId, dispatch, currentUserId]);

    const handleForwardMessage = (msg) => {
        setMessageToForward(msg);
        setShowForwardModal(true);
    };

    // Show error notifications when call state has errors
    useEffect(() => {
        if (callState.error) {
            message.error({
                content: `Call Error: ${callState.error}`,
                duration: 5,
                style: {
                    marginTop: "20px",
                },
            });
        }
    }, [callState.error]);

    if (!conversation) {
        return <EmptyChat />;
    }

    const handleInitiateVoiceCall = async () => {
        try {
            setIsInitiatingCall(true);
            const isGroup = conversation?.type === "group" || conversation?.conversationType === "group";

            if (isGroup) {
                console.log("🎤 [handleInitiateVoiceCall] Group voice call initiated");
                // Get all participant IDs except current user
                const participantIds =
                    conversation?.participants
                        ?.filter((p) => (p.id || p.userId || p.user_id) !== currentUserId)
                        .map((p) => p.id || p.userId || p.user_id) || [];

                if (participantIds.length === 0) {
                    message.error("No participants to call");
                    return;
                }

                // Initiate group call via makeGroupCall to show outgoing UI
                await makeGroupCall(
                    conversationId,
                    "voice",
                    conversation?.name || "Group",
                    participantIds,
                );
            } else {
                console.log("🎤 [handleInitiateVoiceCall] Voice call button clicked");
                const recipientId = getRecipientId();

                if (!recipientId) {
                    console.warn("⚠️ [handleInitiateVoiceCall] No recipientId found");
                    return;
                }

                console.log("🎤 [handleInitiateVoiceCall] Initiating voice call with:", recipientId);
                await makeCall(
                    recipientId,
                    conversationId,
                    "voice",
                    conversation?.name || conversation?.senderName || "User",
                );
            }
        } catch (error) {
            console.error("❌ [handleInitiateVoiceCall] Failed to initiate voice call:", error);
            message.error("Failed to initiate voice call: " + error.message);
        } finally {
            setIsInitiatingCall(false);
        }
    };

    const handleInitiateVideoCall = async () => {
        try {
            setIsInitiatingCall(true);
            const isGroup = conversation?.type === "group" || conversation?.conversationType === "group";

            if (isGroup) {
                console.log("📹 [handleInitiateVideoCall] Group video call initiated");
                // Get all participant IDs except current user
                const participantIds =
                    conversation?.participants
                        ?.filter((p) => (p.id || p.userId || p.user_id) !== currentUserId)
                        .map((p) => p.id || p.userId || p.user_id) || [];

                if (participantIds.length === 0) {
                    message.error("No participants to call");
                    return;
                }

                // Initiate group call via makeGroupCall to show outgoing UI
                await makeGroupCall(
                    conversationId,
                    "video",
                    conversation?.name || "Group",
                    participantIds,
                );
            } else {
                console.log("📹 [handleInitiateVideoCall] Video call button clicked");
                const recipientId = getRecipientId();

                if (!recipientId) {
                    console.warn("⚠️ [handleInitiateVideoCall] No recipientId found");
                    return;
                }

                console.log("📹 [handleInitiateVideoCall] Initiating video call with:", recipientId);
                await makeCall(
                    recipientId,
                    conversationId,
                    "video",
                    conversation?.name || conversation?.senderName || "User",
                );
            }
        } catch (error) {
            console.error("❌ [handleInitiateVideoCall] Failed to initiate video call:", error);
            message.error("Failed to initiate video call: " + error.message);
        } finally {
            setIsInitiatingCall(false);
        }
    };

    // Retry failed call
    const handleRetryCall = async () => {
        try {
            setIsInitiatingCall(true);
            const recipientId = getRecipientId();

            if (!recipientId) {
                return;
            }

            console.log(`🔄 Retrying ${callState.callType} call with:`, recipientId);
            // First end the failed call
            await endCall();

            // Then retry
            await makeCall(
                recipientId,
                conversationId,
                callState.callType || "voice",
                conversation?.name || conversation?.senderName || "User",
            );
        } catch (error) {
            console.error("❌ Failed to retry call:", error);
            message.error("Failed to retry call: " + error.message);
        } finally {
            setIsInitiatingCall(false);
        }
    };


    return (
        <div className={styles.chatWindowContainer}>
           

            <div className={styles.chatWindow}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        {conversation.type === "group" || conversation.conversationType === "group" ? (
                            <GroupAvatar members={conversation.memberAvatars || conversation.participants} size={40} />
                        ) : (
                            <Avatar
                                size={40}
                                src={conversation.avatarPath || conversation.avatar_path || null}
                                style={{
                                    backgroundColor: "#1890ff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "bold",
                                    fontSize: "14px",
                                }}
                            >
                                {!conversation.avatarPath && !conversation.avatar_path && conversation.name
                                    ? getFirstLetterOfEachWord(conversation.name).children
                                    : "U"}
                            </Avatar>
                        )}
                        <div className={styles.headerText}>
                            <h3>{conversation.name}</h3>
                            {(conversation.type === "group" || conversation.conversationType === "group") && (
                                <span className={styles.participants}>
                                    {conversation.memberCount || conversation.participants?.length || 0} members
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Search">
                            <SearchOutlined />
                        </button>
                        <button
                            className={styles.actionBtn}
                            title="Voice Call"
                            onClick={handleInitiateVoiceCall}
                            disabled={isInitiatingCall}
                            loading={isInitiatingCall}
                        >
                            <PhoneOutlined />
                        </button>
                        <button
                            className={styles.actionBtn}
                            title="Video Call"
                            onClick={handleInitiateVideoCall}
                            disabled={isInitiatingCall}
                            loading={isInitiatingCall}
                        >
                            <VideoCameraOutlined />
                        </button>
                        <button className={styles.actionBtn} title="Info" onClick={() => setShowSidebar(!showSidebar)}>
                            <InfoCircleOutlined />
                        </button>
                    </div>
                </div>

                {/* Messages Container */}
                {conversation.isDisbanded || conversation.is_active === false || conversation.isActive === false ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#f9f9f9",
                            padding: "40px",
                            textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: "64px", marginBottom: "20px" }}>
                            {conversation.wasKicked ? "👋" : "🚫"}
                        </div>
                        <h2 style={{ color: "#262626", marginBottom: "8px" }}>
                            {conversation.wasKicked ? "You Were Removed from Group" : "Group Disbanded"}
                        </h2>
                        <p style={{ color: "#8c8c8c", maxWidth: "400px" }}>
                            {conversation.wasKicked
                                ? "You have been removed from this group by the administrator. You can no longer send or receive messages in this conversation."
                                : "This group has been disbanded by the administrator. You can no longer send or receive messages in this conversation."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={styles.messagesContainer} ref={messageContainerRef}>
                            {loadError ? (
                                <div className={styles.errorPlaceholder}>
                                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
                                    <h3>Không thể tải tin nhắn</h3>
                                    <p>{loadError}</p>
                                    <button
                                        onClick={() => {
                                            setLoadError(null);
                                            dispatch(loadMessages({ conversationId, limit: 50 }));
                                        }}
                                        style={{
                                            marginTop: "16px",
                                            padding: "8px 16px",
                                            backgroundColor: "#007bff",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                        }}
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            ) : isLoadingMessages ? (
                                <div className={styles.loadingPlaceholder}>
                                    <span className={styles.spinner}></span>
                                    <p>Loading messages...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className={styles.emptyPlaceholder}>
                                    <div>💬</div>
                                    <h3>No messages yet</h3>
                                    <p>Send a message to start the conversation</p>
                                </div>
                            ) : (
                                <MessageList
                                    messages={messages}
                                    conversationId={conversationId}
                                    currentUserId={currentUserId}
                                    onForward={handleForwardMessage}
                                />
                            )}

                            {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <MessageInput conversationId={conversationId} />
                    </>
                )}
            </div>

            {/* Sidebar */}
            {showSidebar && (
                <ChatSidebar
                    conversation={conversation}
                    currentUserId={currentUserId}
                    onClose={() => setShowSidebar(false)}
                    onOpenGroupSettings={() => setShowGroupSettings(true)}
                    onOpenAddMembersModal={() => setShowAddMembersModal(true)}
                />
            )}

            {/* Modals */}
            <ForwardModal
                visible={showForwardModal}
                onClose={() => setShowForwardModal(false)}
                messageToForward={messageToForward}
            />

            <GroupSettingsModal
                visible={showGroupSettings}
                onClose={() => setShowGroupSettings(false)}
                conversation={conversation}
            />

            <AddMembersModal
                visible={showAddMembersModal}
                onClose={() => setShowAddMembersModal(false)}
                conversation={conversation}
                participants={conversation?.participants || []}
                onMembersAdded={() => dispatch(loadConversations())}
            />
            {/* Call Window Overlay */}
            {(callState.inCall || callState.outgoingCallId || callState.incomingCall) && (
                <CallWindow
                    callState={callState}
                    userId={currentUserId}
                    onEndCall={endCall}
                    isIncomingMode={!!callState.incomingCall && !callState.inCall}
                    onAcceptVO={() => acceptCall("voice")}
                    onAcceptVideo={() => acceptCall("video")}
                    onReject={rejectCall}
                    onRetry={handleRetryCall}
                    onToggleAudio={toggleAudio}
                    onToggleVideo={toggleVideo}
                />
            )}
        </div>
    );
};

export default ChatWindow;
