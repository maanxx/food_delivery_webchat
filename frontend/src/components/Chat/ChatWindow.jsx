import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, message, Select, Tag } from "antd";
import { InfoCircleOutlined, PhoneOutlined, SearchOutlined, VideoCameraOutlined, LeftOutlined } from "@ant-design/icons";
import styles from "./ChatWindow.module.css";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";
import useWebSocket from "@hooks/useWebSocket";

import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import EmptyChat from "./EmptyChat";
import CallWindow from "./CallWindow";
import ForwardModal from "./ForwardModal";
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
    updateTicketStatus,
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

    const user = useSelector((state) => state.auth.user);
    const currentUserId = user?.sub || user?.user_id || user?.userId || user?.id;

    const navigate = useNavigate();
    const handleBackClick = () => {
        navigate('/');
    };

    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [isInitiatingCall, setIsInitiatingCall] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);

    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null);

    const getRecipientId = () => {

        if (conversation?.type === "group" || conversation?.conversationType === "group") {
            return null;
        }

        const directRecipientId =
            conversation?.recipientId ||
            conversation?.recipient_id ||
            conversation?.memberId ||
            conversation?.otherUserId ||
            conversation?.participantId;

        if (directRecipientId && directRecipientId !== currentUserId) {
            return directRecipientId;
        }

        if (conversation?.members && Array.isArray(conversation.members)) {
            const recipient = conversation.members.find((m) => (m.id || m.userId || m.user_id) !== currentUserId);
            if (recipient) {
                const recipientId = recipient.id || recipient.userId || recipient.user_id;
                return recipientId;
            }
        }

        if (conversation?.participants && Array.isArray(conversation.participants)) {
            const recipient = conversation.participants.find((p) => (p.id || p.userId || p.user_id) !== currentUserId);
            if (recipient) {
                const recipientId = recipient.id || recipient.userId || recipient.user_id;
                return recipientId;
            }
        }

        if (Array.isArray(messages) && messages.length > 0) {
            const otherMessage = messages.find((msg) => msg.senderId !== currentUserId);
            if (otherMessage?.senderId) {
                return otherMessage.senderId;
            }
        }

        if (conversation?.createdBy && conversation.createdBy !== currentUserId) {
            return conversation.createdBy;
        }

        message.error("Unable to determine recipient. Please refresh the conversation.");
        return null;
    };

    useEffect(() => {
        if (!conversationId) {
            return;
        }

        setIsLoadingMessages(true);
        setLoadError(null);
        dispatch(loadMessages({ conversationId, limit: 50 }))
            .unwrap()
            .catch((error) => {
                setLoadError(error);
            })
            .finally(() => setIsLoadingMessages(false));
    }, [conversationId, dispatch]);

    useEffect(() => {
        if (!isConnected || !conversationId) {
            return;
        }

        socket?.emit("join_conversation", conversationId);

        return () => {
            socket?.emit("leave_conversation", conversationId);
        };
    }, [conversationId, socket, isConnected]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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

    const handleTicketStatusChange = (status) => {
        dispatch(updateTicketStatus({ conversationId, status }));
    };

    const getTicketStatusColor = (status) => {
        switch (status) {
            case 'open': return 'green';
            case 'in_progress': return 'orange';
            case 'resolved': return 'default';
            default: return 'default';
        }
    };

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
                const participantIds =
                    conversation?.participants
                        ?.filter((p) => (p.id || p.userId || p.user_id) !== currentUserId)
                        .map((p) => p.id || p.userId || p.user_id) || [];

                if (participantIds.length === 0) {
                    message.error("No participants to call");
                    return;
                }

                await makeGroupCall(
                    conversationId,
                    "voice",
                    conversation?.name || "Group",
                    participantIds,
                );
            } else {
                const recipientId = getRecipientId();

                if (!recipientId) {
                    return;
                }

                await makeCall(
                    recipientId,
                    conversationId,
                    "voice",
                    conversation?.name || conversation?.senderName || "User",
                );
            }
        } catch (error) {
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
                const participantIds =
                    conversation?.participants
                        ?.filter((p) => (p.id || p.userId || p.user_id) !== currentUserId)
                        .map((p) => p.id || p.userId || p.user_id) || [];

                if (participantIds.length === 0) {
                    message.error("No participants to call");
                    return;
                }

                await makeGroupCall(
                    conversationId,
                    "video",
                    conversation?.name || "Group",
                    participantIds,
                );
            } else {
                const recipientId = getRecipientId();

                if (!recipientId) {
                    return;
                }

                await makeCall(
                    recipientId,
                    conversationId,
                    "video",
                    conversation?.name || conversation?.senderName || "User",
                );
            }
        } catch (error) {
            message.error("Failed to initiate video call: " + error.message);
        } finally {
            setIsInitiatingCall(false);
        }
    };

    const handleRetryCall = async () => {
        try {
            setIsInitiatingCall(true);
            const recipientId = getRecipientId();

            if (!recipientId) {
                return;
            }

            await endCall();

            await makeCall(
                recipientId,
                conversationId,
                callState.callType || "voice",
                conversation?.name || conversation?.senderName || "User",
            );
        } catch (error) {
            message.error("Failed to retry call: " + error.message);
        } finally {
            setIsInitiatingCall(false);
        }
    };


    return (
        <div className={styles.chatWindowContainer}>
           

            <div className={styles.chatWindow}>
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        <LeftOutlined 
                            className={styles.mobileBackBtn} 
                            onClick={handleBackClick}
                        />
                        {conversation.type === "group" || conversation.conversationType === "group" ? (
                            <GroupAvatar members={conversation.memberAvatars || conversation.participants} size={40} />
                        ) : (
                            <Avatar
                                size={40}
                                src={conversation.avatarPath || conversation.avatar_path || null}
                                style={{
                                    backgroundColor: "var(--primary-color)",
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
                            {(conversation.type === "group" || conversation.conversationType === "group") ? (
                                <span className={styles.participants}>
                                    {conversation.memberCount || conversation.participants?.length || 0} thành viên
                                </span>
                            ) : (
                                <span className={styles.statusOnline}>
                                    <span className={styles.statusDot}></span>
                                    Active now
                                </span>
                            )}
                        </div>
                        {conversation.referenceOrderId && (
                            <div style={{ marginLeft: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Select
                                    value={conversation.ticketStatus || "open"}
                                    onChange={handleTicketStatusChange}
                                    style={{ width: 140 }}
                                    options={[
                                        { value: 'open', label: '🟢 Mở ticket' },
                                        { value: 'in_progress', label: '🟠 Đang xử lý' },
                                        { value: 'resolved', label: '⚫ Đã giải quyết' },
                                    ]}
                                    size="small"
                                />
                                <Tag color={getTicketStatusColor(conversation.ticketStatus || "open")}>
                                    Order #{conversation.referenceOrderId}
                                </Tag>
                            </div>
                        )}
                    </div>
                    <div className={styles.actions}>
                        <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} title="Gọi thoại" onClick={handleInitiateVoiceCall} disabled={isInitiatingCall}>
                            <PhoneOutlined />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} title="Gọi video" onClick={handleInitiateVideoCall} disabled={isInitiatingCall}>
                            <VideoCameraOutlined />
                        </button>
                        <button className={styles.actionBtn} title="Tìm kiếm">
                            <SearchOutlined />
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
                            {conversation.wasKicked ? "Bạn đã bị xóa khỏi nhóm" : "Nhóm đã giải tán"}
                        </h2>
                        <p style={{ color: "#8c8c8c", maxWidth: "400px" }}>
                            {conversation.wasKicked
                                ? "Bạn đã bị xóa khỏi nhóm này bởi quản trị viên. Bạn không thể gửi hoặc nhận tin nhắn nữa."
                                : "Nhóm này đã bị giải tán bởi quản trị viên. Bạn không thể gửi hoặc nhận tin nhắn nữa."}
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
                                            backgroundColor: "var(--primary-color)",
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
                                    <p>Đang tải tin nhắn...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className={styles.emptyPlaceholder}>
                                    <div>💬</div>
                                    <h3>Chưa có tin nhắn nào</h3>
                                    <p>Gửi một tin nhắn để bắt đầu cuộc trò chuyện</p>
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

            {/* Removed ChatSidebar, now using DirectoryPanel */}

            {/* Modals */}
            <ForwardModal
                visible={showForwardModal}
                onClose={() => setShowForwardModal(false)}
                messageToForward={messageToForward}
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
