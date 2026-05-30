import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Tag, message } from "antd";
import {
    SearchOutlined,
    PlusOutlined,
    SettingOutlined,
    CloseOutlined,
    DeleteOutlined,
    SoundOutlined,
    PhoneOutlined,
    VideoCameraOutlined,
    RightOutlined,
    EllipsisOutlined,
} from "@ant-design/icons";
import styles from "./Sidebar.module.css";
import GroupAvatar from "./GroupAvatar";
import {
    loadConversations,
    selectConversation,
    searchUsers,
    createConversation,
    createGroupConversation,
    clearSearchResults,
    selectMessages,
    deleteConversation,
} from "@features/chat/chatSlice";
import useWebSocket from "@hooks/useWebSocket";
import callService from "@services/callService";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";

const Sidebar = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { updateStatus } = useWebSocket();

    // Track auth state to reload conversations when user changes
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

    const conversations = useSelector((state) =>
        state.chat.conversations.allIds.map((id) => state.chat.conversations.byId[id]).filter(Boolean),
    );
    const selectedConvId = useSelector((state) => state.chat.conversations.selectedId);
    const searchResults = useSelector((state) => state.chat.searchResults);
    const isSearching = useSelector((state) => state.chat.isSearching);

    // Debug: Log when conversations change
    useEffect(() => {
        console.log("📋 Sidebar conversations updated:", {
            count: conversations.length,
            conversations: conversations.map((c) => ({ id: c.conversationId, name: c.name })),
        });
    }, [conversations]);

    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [addUserSearchQuery, setAddUserSearchQuery] = useState("");
    const [addUserSearchResults, setAddUserSearchResults] = useState([]);
    const [isAddUserSearching, setIsAddUserSearching] = useState(false);
    const [isCreatingConversation, setIsCreatingConversation] = useState(false);
    const [deleteModalState, setDeleteModalState] = useState({
        showModal: false,
        conversationId: null,
        conversationName: null,
        isDeleting: false,
        error: null,
    });

    // Group creation state
    const [isGroupMode, setIsGroupMode] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [groupName, setGroupName] = useState("");

    // Handle delete modal events
    useEffect(() => {
        const handleOpenDeleteModal = (event) => {
            const { conversationId, conversationName } = event.detail;

            // Validate conversation exists in state
            const conversationExists = conversations.some((conv) => conv.conversationId === conversationId);

            setDeleteModalState({
                showModal: true,
                conversationId,
                conversationName,
                isDeleting: false,
                error: conversationExists ? null : "Conversation does not exist or has been deleted",
            });
        };

        const handleConfirmDelete = async (event) => {
            const { conversationId } = event.detail;

            // Validate conversation still exists before deleting
            const conversationExists = conversations.some((conv) => conv.conversationId === conversationId);

            if (!conversationExists) {
                setDeleteModalState((prev) => ({
                    ...prev,
                    isDeleting: false,
                    error: "Conversation does not exist or has been deleted",
                }));
                return;
            }

            setDeleteModalState((prev) => ({ ...prev, isDeleting: true, error: null }));
            try {
                await dispatch(deleteConversation(conversationId)).unwrap();
                console.log("✅ Conversation deleted successfully");
                setDeleteModalState((prev) => ({ ...prev, showModal: false, isDeleting: false }));
            } catch (error) {
                console.error("❌ Failed to delete conversation:", error);
                let errorMsg = "Unable to delete conversation";

                // Provide specific error messages
                if (error?.response?.status === 404) {
                    errorMsg = "Conversation does not exist or has been deleted";
                } else if (error?.message) {
                    errorMsg = error.message;
                } else if (typeof error === "string") {
                    errorMsg = error;
                }

                setDeleteModalState((prev) => ({ ...prev, isDeleting: false, error: errorMsg }));
            }
        };

        window.addEventListener("openDeleteModal", handleOpenDeleteModal);
        window.addEventListener("confirmDeleteConversation", handleConfirmDelete);

        return () => {
            window.removeEventListener("openDeleteModal", handleOpenDeleteModal);
            window.removeEventListener("confirmDeleteConversation", handleConfirmDelete);
        };
    }, [dispatch, conversations]);

    useEffect(() => {
        if (!isAuthenticated) {
            console.log("❌ Not authenticated, skipping loadConversations");
            return;
        }

        setIsLoadingConversations(true);
        dispatch(loadConversations({ limit: 50 }))
            .unwrap()
            .then((result) => {
                console.log("✅ Loaded conversations:", {
                    count: result.conversations?.length || 0,
                    hasMore: result.hasMore,
                    conversations: result.conversations,
                });
            })
            .catch((err) => {
                console.error("❌ Failed to load conversations:", err);
            })
            .finally(() => setIsLoadingConversations(false));
    }, [dispatch, isAuthenticated]);

    // Update status on mount
    useEffect(() => {
        updateStatus("online");
        return () => updateStatus("offline");
    }, [updateStatus]);

    // Handle search
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            dispatch(searchUsers({ query, limit: 20 }));
        } else {
            dispatch(clearSearchResults());
        }
    };

    // Select conversation
    const handleSelectConversation = (conversationId) => {
        dispatch(selectConversation(conversationId));
        navigate(`/admin/chat/${conversationId}`);
    };

    const handleSelectUser = async (userId) => {
        if (isCreatingConversation) {
            return;
        }

        try {
            setIsCreatingConversation(true);

            // Enhanced check: Look for existing 1-to-1 conversation with this user
            const existingConversation = conversations.find((conv) => {
                // Skip group conversations
                if (conv.conversationType === "group") {
                    return false;
                }

                // Check direct participantId field
                if (conv.participantId === userId || conv.participant_id === userId) {
                    return true;
                }

                // Check participants array
                if (Array.isArray(conv.participants) && conv.participants.length > 0) {
                    return conv.participants.some(
                        (p) => p.userId === userId || p.user_id === userId || p.id === userId,
                    );
                }

                return false;
            });

            if (existingConversation) {
                // Conversation already exists, just select it
                console.log("✅ Conversation already exists:", existingConversation.conversationId);
                handleSelectConversation(existingConversation.conversationId);
            } else {
                // Create new conversation if it doesn't exist
                const result = await dispatch(createConversation({ participantId: userId })).unwrap();
                console.log("Create conversation result:", result);

                // Ensure participantId is set for future duplicate checks
                if (result && !result.participantId && !result.participant_id) {
                    result.participantId = userId;
                }

                handleSelectConversation(result.conversationId);
            }

            // Clear search and modal
            setSearchQuery("");
            dispatch(clearSearchResults());
            setShowAddUserModal(false);
            setAddUserSearchQuery("");
            setAddUserSearchResults([]);
        } catch (error) {
            console.error("Failed to create conversation:", error);
        } finally {
            setIsCreatingConversation(false);
        }
    };

    // Handle search users for add new chat
    const handleAddUserSearch = (query) => {
        setAddUserSearchQuery(query);
        if (query.trim()) {
            setIsAddUserSearching(true);
            dispatch(searchUsers({ query, limit: 20 }))
                .unwrap()
                .then((results) => {
                    console.log("Search results:", results);

                    setAddUserSearchResults(Array.isArray(results) ? results : []);
                })
                .catch((err) => {
                    console.error("Failed to search users:", err);
                    setAddUserSearchResults([]);
                })
                .finally(() => setIsAddUserSearching(false));
        } else {
            setAddUserSearchResults([]);
        }
    };

    const handleToggleMember = (user) => {
        const userId = user.user_id || user.userId;
        if (selectedMembers.find((m) => (m.user_id || m.userId) === userId)) {
            setSelectedMembers(selectedMembers.filter((m) => (m.user_id || m.userId) !== userId));
        } else {
            setSelectedMembers([...selectedMembers, user]);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            message.error("Please enter a group name");
            return;
        }
        if (selectedMembers.length === 0) {
            message.error("Please select at least one member");
            return;
        }

        try {
            setIsCreatingConversation(true);
            const participantIds = selectedMembers.map((m) => m.user_id || m.userId);
            const result = await dispatch(
                createGroupConversation({
                    name: groupName,
                    participantIds,
                }),
            ).unwrap();

            handleSelectConversation(result.conversationId);
            setShowAddUserModal(false);
            resetGroupState();
        } catch (error) {
            message.error(error || "Failed to create group");
        } finally {
            setIsCreatingConversation(false);
        }
    };

    const resetGroupState = () => {
        setIsGroupMode(false);
        setSelectedMembers([]);
        setGroupName("");
        setAddUserSearchQuery("");
        setAddUserSearchResults([]);
    };

    const displayList = searchQuery ? searchResults : conversations;
    const isLoading = isSearching || (isLoadingConversations && !conversations.length);

    return (
        <div className={styles.sidebar}>
            {/* Header */}
            <div className={styles.header}>
                <h2>Messages</h2>
                <div className={styles.headerActions}>
                    <button className={styles.headerBtn} title="New chat" onClick={() => setShowAddUserModal(true)}>
                        <PlusOutlined />
                    </button>
                    <button className={styles.headerBtn} title="Settings">
                        <SettingOutlined />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => setShowSearch(true)}
                    className={styles.searchInput}
                />
                <SearchOutlined className={styles.searchIcon} />
            </div>

            {/* Conversations/Results List */}
            <div className={styles.listContainer}>
                {isLoading ? (
                    <div className={styles.placeholder}>
                        <span className={styles.spinner}></span>
                        <p>Loading...</p>
                    </div>
                ) : displayList.length === 0 ? (
                    <div className={styles.placeholder}>
                        <p>{searchQuery ? "No results" : "No conversations yet"}</p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {searchQuery
                            ? searchResults.map((user) => (
                                  <div
                                      key={user.userId || user.user_id}
                                      className={styles.userItem}
                                      onClick={() =>
                                          !isCreatingConversation && handleSelectUser(user.userId || user.user_id)
                                      }
                                      style={{
                                          opacity: isCreatingConversation ? 0.5 : 1,
                                          pointerEvents: isCreatingConversation ? "none" : "auto",
                                      }}
                                  >
                                      <Avatar
                                          size={40}
                                          src={user.avatar_path || user.avatarPath || null}
                                          style={{
                                              backgroundColor: "#1890ff",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              fontWeight: "bold",
                                              fontSize: "14px",
                                          }}
                                      >
                                          {!user.avatar_path && !user.avatarPath && user.username
                                              ? getFirstLetterOfEachWord(user.username).children
                                              : !user.avatar_path && !user.avatarPath && user.fullname
                                                ? getFirstLetterOfEachWord(user.fullname).children
                                                : "U"}
                                      </Avatar>
                                      <div className={styles.userInfo}>
                                          <div className={styles.userName}>{user.username}</div>
                                          <div className={styles.userEmail}>{user.email}</div>
                                      </div>
                                  </div>
                              ))
                            : conversations.map((conv) => (
                                  <ConversationItem
                                      key={conv.conversationId}
                                      conv={conv}
                                      isSelected={selectedConvId === conv.conversationId}
                                      onSelect={() => handleSelectConversation(conv.conversationId)}
                                  />
                              ))}
                    </div>
                )}
            </div>

            {/* Delete Conversation Modal */}
            {deleteModalState.showModal && (
                <div
                    className={styles.modalOverlay}
                    onClick={() =>
                        !deleteModalState.isDeleting &&
                        setDeleteModalState((prev) => ({ ...prev, showModal: false, error: null }))
                    }
                >
                    <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.deleteModalHeader}>
                            <h3>
                                <DeleteOutlined /> Delete Conversation
                            </h3>
                        </div>
                        <div className={styles.deleteModalBody}>
                            {deleteModalState.error ? (
                                <p className={styles.errorMessage}>❌ {deleteModalState.error}</p>
                            ) : (
                                <>
                                    <p>
                                        Are you sure you want to delete the conversation with{" "}
                                        <strong>{deleteModalState.conversationName}</strong>?
                                    </p>
                                    <p className={styles.deleteWarning}>This action cannot be undone.</p>
                                </>
                            )}
                        </div>
                        <div className={styles.deleteModalFooter}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() =>
                                    !deleteModalState.isDeleting &&
                                    setDeleteModalState((prev) => ({ ...prev, showModal: false, error: null }))
                                }
                                disabled={deleteModalState.isDeleting}
                            >
                                {deleteModalState.error ? "Close" : "Cancel"}
                            </button>
                            {!deleteModalState.error && (
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => {
                                        window.dispatchEvent(
                                            new CustomEvent("confirmDeleteConversation", {
                                                detail: { conversationId: deleteModalState.conversationId },
                                            }),
                                        );
                                    }}
                                    disabled={deleteModalState.isDeleting}
                                >
                                    {deleteModalState.isDeleting ? "⏳ Deleting..." : "Delete"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddUserModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddUserModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={styles.modalHeader}>
                            <h3>{isGroupMode ? "Create New Group" : "Start New Chat"}</h3>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    className={`${styles.headerBtn} ${isGroupMode ? styles.active : ""}`}
                                    onClick={() => {
                                        if (isGroupMode) {
                                            resetGroupState();
                                        } else {
                                            setIsGroupMode(true);
                                        }
                                    }}
                                    title={isGroupMode ? "Cancel Group" : "Create Group"}
                                    style={{
                                        color: isGroupMode ? "#1890ff" : "inherit",
                                        background: isGroupMode ? "#e6f7ff" : "transparent",
                                    }}
                                >
                                    <PlusOutlined />
                                </button>
                                <button
                                    className={styles.closeBtn}
                                    onClick={() => {
                                        setShowAddUserModal(false);
                                        resetGroupState();
                                    }}
                                    title="Close"
                                >
                                    <CloseOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Group Name Input */}
                        {isGroupMode && (
                            <div style={{ padding: "0 20px 15px" }}>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        type="text"
                                        placeholder="Enter group name..."
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        className={styles.modalSearchInput}
                                        style={{ borderBottom: "2px solid #1890ff", flex: 1 }}
                                    />
                                    <Button
                                        type="primary"
                                        onClick={handleCreateGroup}
                                        loading={isCreatingConversation}
                                        disabled={!groupName.trim() || selectedMembers.length === 0}
                                    >
                                        Create ({selectedMembers.length})
                                    </Button>
                                </div>
                                {selectedMembers.length > 0 && (
                                    <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                        {selectedMembers.map((m) => (
                                            <Tag
                                                key={m.user_id || m.userId}
                                                closable
                                                onClose={() => handleToggleMember(m)}
                                                color="blue"
                                            >
                                                {m.fullname || m.username}
                                            </Tag>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Search Input */}
                        <div className={styles.modalSearchContainer}>
                            <input
                                type="text"
                                placeholder="Search by email or phone..."
                                value={addUserSearchQuery}
                                onChange={(e) => handleAddUserSearch(e.target.value)}
                                className={styles.modalSearchInput}
                                autoFocus
                            />
                            <SearchOutlined className={styles.searchIcon} />
                        </div>

                        {/* Results */}
                        <div className={styles.modalResults}>
                            {isAddUserSearching ? (
                                <div className={styles.loadingSpinner}>
                                    <span className={styles.spinner}></span>
                                    <p>Searching...</p>
                                </div>
                            ) : !addUserSearchQuery ? (
                                <div className={styles.noResults}>
                                    <p>Enter email or phone number to search</p>
                                </div>
                            ) : addUserSearchResults.length === 0 ? (
                                <div className={styles.noResults}>
                                    <p>No users found</p>
                                </div>
                            ) : (
                                addUserSearchResults.map((user) => (
                                    <div
                                        key={user.user_id || user.userId}
                                        className={styles.modalUserItem}
                                        onClick={() => {
                                            if (isGroupMode) {
                                                handleToggleMember(user);
                                            } else if (!isCreatingConversation) {
                                                handleSelectUser(user.user_id || user.userId);
                                            }
                                        }}
                                        style={{
                                            opacity: isCreatingConversation ? 0.5 : 1,
                                            pointerEvents: isCreatingConversation ? "none" : "auto",
                                            backgroundColor: selectedMembers.find(
                                                (m) => (m.user_id || m.userId) === (user.user_id || user.userId),
                                            )
                                                ? "#e6f7ff"
                                                : "transparent",
                                        }}
                                    >
                                        <Avatar
                                            size={40}
                                            src={user.avatar_path || user.avatarPath || null}
                                            style={{
                                                backgroundColor: "#1890ff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "bold",
                                                fontSize: "14px",
                                            }}
                                            className={styles.modalAvatar}
                                        >
                                            {!user.avatar_path && user.fullname
                                                ? getFirstLetterOfEachWord(user.fullname || "").children
                                                : !user.avatar_path && user.username
                                                  ? getFirstLetterOfEachWord(user.username || "").children
                                                  : "U"}
                                        </Avatar>
                                        <div className={styles.modalUserInfo}>
                                            <div className={styles.modalUserName}>{user.fullname || user.username}</div>
                                            <div className={styles.modalUserEmail}>{user.email}</div>
                                            {user.phone_number && user.phone_number.match(/^\+?\d{10,15}$/) && (
                                                <div className={styles.modalUserPhone}>
                                                    {user.phone_number || user.phone}
                                                </div>
                                            )}
                                        </div>
                                        <button className={styles.selectBtn}>
                                            <RightOutlined />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper function to format relative time
const formatRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // Seconds
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;

    // Minutes
    if (minutes === 1) return "1m ago";
    if (minutes < 60) return `${minutes}m ago`;

    // Hours
    if (hours === 1) return "1h ago";
    if (hours < 24) return `${hours}h ago`;

    // Days
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
    } else if (days < 7) {
        return `${days}d ago`;
    }

    // Specific date
    return messageDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: messageDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
};

// Conversation item component
const ConversationItem = ({ conv, isSelected, onSelect }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const menuRef = React.useRef(null);

    // Get last message text from conversation lastMessage object or fallback to messages store
    const convMessages = useSelector(selectMessages(conv.conversationId));

    // Sort messages by createdAt to ensure we get the TRUE last message
    const sortedMessages =
        convMessages && Array.isArray(convMessages)
            ? [...convMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            : [];

    const lastMessageObj = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null;
    const lastMessageText = lastMessageObj?.content || conv.lastMessage?.content || "No messages yet";
    const lastMessageSender = lastMessageObj?.senderName || conv.lastMessage?.senderName || "";
    const lastMessageTime = lastMessageObj?.createdAt || conv.lastMessageTimestamp;

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
        if (!showMenu) {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
                top: rect.top + 30,
                left: rect.left - 135,
            });
        }
    };

    const handleMenuOption = (option, e) => {
        e.stopPropagation();
        console.log(`Selected option for ${conv.name}:`, option);
        switch (option) {
            case "delete":
                window.dispatchEvent(
                    new CustomEvent("openDeleteModal", {
                        detail: { conversationId: conv.conversationId, conversationName: conv.name },
                    }),
                );
                setShowMenu(false);
                break;
            case "mute":
                console.log("Mute notifications for:", conv.conversationId);
                // TODO: Implement mute notifications
                break;
            case "call":
                handleInitiateCall("voice", conv);
                setShowMenu(false);
                break;
            case "video":
                handleInitiateCall("video", conv);
                setShowMenu(false);
                break;
            default:
                break;
        }
    };

    // Handle initiating calls from conversation menu
    const handleInitiateCall = async (callType, conversation) => {
        try {
            const isGroup = conversation?.type === "group" || conversation?.conversationType === "group";

            if (isGroup) {
                console.log(`📞 Initiating ${callType} group call`);
                const participantIds =
                    conversation?.participants?.map((p) => p.id || p.userId || p.user_id).filter(Boolean) || [];

                if (participantIds.length === 0) {
                    message.error("No participants in this group");
                    return;
                }

                const response = await callService.initiateGroupCall(
                    conversation.conversationId,
                    callType,
                    participantIds,
                );
                console.log(`📞 ${callType} group call initiated:`, response.data);
                message.success(`Group ${callType} call started`);
            } else {
                console.log(`📞 Initiating ${callType} call with ${conversation.name}`);
                // For 1-1 calls, navigate to chat and trigger call
                window.dispatchEvent(
                    new CustomEvent("initiateCall", {
                        detail: {
                            conversationId: conversation.conversationId,
                            callType: callType,
                        },
                    }),
                );
            }
        } catch (error) {
            console.error(`❌ Failed to initiate ${callType} call:`, error);
            message.error(`Failed to initiate ${callType} call: ${error.message}`);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showMenu]);

    return (
        <div className={`${styles.conversationItem} ${isSelected ? styles.selected : ""}`} onClick={onSelect}>
            {conv.type === "group" || conv.conversationType === "group" ? (
                <GroupAvatar members={conv.memberAvatars || conv.participants} size={40} />
            ) : (
                <Avatar
                    size={40}
                    src={conv.avatar_path || conv.avatarPath || null}
                    style={{
                        backgroundColor: "#1890ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "14px",
                    }}
                >
                    {!conv.avatar_path && !conv.avatarPath && conv.name
                        ? getFirstLetterOfEachWord(conv.name).children
                        : "U"}
                </Avatar>
            )}
            <div className={styles.convInfo}>
                <div className={styles.convName}>
                    {conv.name}
                    {(conv.isDisbanded || conv.is_active === false) && (
                        <span style={{ color: "#ff4d4f", fontSize: "11px", marginLeft: "8px", fontWeight: "normal" }}>
                            (Disbanded)
                        </span>
                    )}
                </div>
                <div className={styles.convPreview}>
                    {conv.conversationType === "group" && lastMessageSender
                        ? `${lastMessageSender}: ${lastMessageText}`
                        : lastMessageText}
                </div>
            </div>
            <div className={styles.convActions}>
                {lastMessageTime && (
                    <div className={styles.convTime}>{formatRelativeTime(new Date(lastMessageTime).getTime())}</div>
                )}
                <button className={styles.menuBtn} onClick={handleMenuClick} title="More options">
                    <EllipsisOutlined />
                </button>
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
                <div
                    className={styles.dropdownMenu}
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                    ref={menuRef}
                >
                    <div className={styles.menuOption} onClick={(e) => handleMenuOption("delete", e)}>
                        <DeleteOutlined /> Delete
                    </div>
                    <div className={styles.menuOption} onClick={(e) => handleMenuOption("mute", e)}>
                        <SoundOutlined /> Mute
                    </div>
                    <div className={styles.menuOption} onClick={(e) => handleMenuOption("call", e)}>
                        <PhoneOutlined /> Call
                    </div>
                    <div className={styles.menuOption} onClick={(e) => handleMenuOption("video", e)}>
                        <VideoCameraOutlined /> Video Call
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
