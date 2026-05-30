import React, { useState } from "react";
import { Avatar, message, Modal } from "antd";
import {
    BarsOutlined,
    UserOutlined,
    BellOutlined,
    SearchOutlined,
    InfoCircleOutlined,
    EditOutlined,
    FileOutlined,
    RightOutlined,
    PlusOutlined,
    DeleteOutlined,
    CrownOutlined,
    UserDeleteOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
import styles from "./ChatSidebar.module.css";
import { removeMemberFromGroup, disbandGroup, addMessage } from "@features/chat/chatSlice";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";
import GroupAvatar from "./GroupAvatar";

const ChatSidebar = ({ conversation, currentUserId, onClose, onOpenGroupSettings, onOpenAddMembersModal }) => {
    const dispatch = useDispatch();
    const isGroup = conversation?.type === "group" || conversation?.conversationType === "group";

    // Default expanded sections based on chat type
    const [expandedSection, setExpandedSection] = useState(isGroup ? "members" : "info");

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const participants = conversation?.participants || [];
    const isAdmin =
        participants.find((p) => p.userId === currentUserId || p.user_id === currentUserId)?.role === "admin";

    const handleRemoveMember = (memberId, memberName) => {
        Modal.confirm({
            title: "Remove Member",
            content: `Are you sure you want to remove ${memberName} from the group?`,
            okText: "Remove",
            okType: "danger",
            cancelText: "Cancel",
            async onOk() {
                try {
                    await dispatch(
                        removeMemberFromGroup({ conversationId: conversation.conversationId, memberId }),
                    ).unwrap();
                    message.success(`Removed ${memberName} successfully`);

                    // The backend will broadcast the system message
                } catch (error) {
                    message.error(error || "Failed to remove member");
                }
            },
        });
    };

    const handleDisbandGroup = () => {
        Modal.confirm({
            title: "Disband Group",
            content:
                "Are you sure you want to DISBAND this group? All members will be removed and the chat will become read-only. This action cannot be undone.",
            okText: "Disband",
            okType: "danger",
            cancelText: "Cancel",
            async onOk() {
                try {
                    await dispatch(disbandGroup(conversation.conversationId)).unwrap();
                    message.success("Group disbanded successfully");
                    onClose();
                    window.location.href = "/admin/chat";
                } catch (error) {
                    message.error(error || "Failed to disband group");
                }
            },
        });
    };

    // --- SHARED COMPONENTS ---
    const mediaSection = {
        id: "files",
        label: "Media, Files & Links",
        icon: <FileOutlined />,
        content: (
            <div className={styles.sectionContent}>
                <div className={styles.fileList}>
                    <p className={styles.emptyFiles}>No shared media yet</p>
                </div>
            </div>
        ),
    };

    // --- GROUP LAYOUT SECTIONS ---
    const groupSections = [
        {
            id: "members",
            label: `Group Members (${participants.length})`,
            icon: <UserOutlined />,
            content: (
                <div className={styles.sectionContent}>
                    {isAdmin && !conversation.isDisbanded && conversation.is_active !== false && (
                        <button className={styles.addMemberBtn} onClick={onOpenAddMembersModal}>
                            <PlusOutlined /> Add Member
                        </button>
                    )}
                    <div className={styles.memberList}>
                        {participants.map((member) => (
                            <div key={member.userId || member.user_id} className={styles.memberItem}>
                                <div className={styles.memberInfo}>
                                    <Avatar
                                        size={32}
                                        src={member.avatarPath || member.avatar_path}
                                        style={{ backgroundColor: "#1890ff" }}
                                    >
                                        {!member.avatarPath && !member.avatar_path
                                            ? getFirstLetterOfEachWord(member.fullname || member.username || "U")
                                                  .children
                                            : null}
                                    </Avatar>
                                    <div className={styles.memberNameContainer}>
                                        <span className={styles.memberName}>{member.fullname || member.username}</span>
                                        {member.role === "admin" && (
                                            <span className={styles.adminBadge} title="Owner">
                                                <CrownOutlined style={{ color: "#faad14" }} />
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isAdmin &&
                                    member.role !== "admin" &&
                                    !conversation.isDisbanded &&
                                    conversation.is_active !== false &&
                                    conversation.isActive !== false && (
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() =>
                                                handleRemoveMember(
                                                    member.userId || member.user_id,
                                                    member.fullname || member.username,
                                                )
                                            }
                                        >
                                            <UserDeleteOutlined />
                                        </button>
                                    )}
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: "groupSettings",
            label: "Group Settings & Customization",
            icon: <BarsOutlined />,
            content: (
                <div className={styles.sectionContent}>
                    <button className={styles.customizeBtn}>🔔 Mute Group Notifications</button>
                    <button className={styles.customizeBtn}>🎨 Change Group Theme</button>
                    <button className={styles.customizeBtn} onClick={onOpenGroupSettings}>
                        {conversation.isDisbanded || conversation.is_active === false || conversation.isActive === false
                            ? "👁️ View Group Info"
                            : "⚙️ Edit Group Info & Roles"}
                    </button>
                    {isAdmin &&
                        !conversation.isDisbanded &&
                        conversation.is_active !== false &&
                        conversation.isActive !== false && (
                            <button
                                className={styles.customizeBtn}
                                style={{
                                    color: "#ff4d4f",
                                    marginTop: "12px",
                                    borderTop: "1px solid #f0f0f0",
                                    paddingTop: "12px",
                                }}
                                onClick={handleDisbandGroup}
                            >
                                🚩 Disband Group
                            </button>
                        )}
                </div>
            ),
        },
        mediaSection,
    ];

    // --- PERSONAL LAYOUT SECTIONS ---
    const personalSections = [
        {
            id: "info",
            label: "User Information",
            icon: <InfoCircleOutlined />,
            content: (
                <div className={styles.sectionContent}>
                    <div className={styles.infoItem}>
                        <span>Full Name:</span>
                        <p>{conversation?.name}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <span>Status:</span>
                        <p>Online</p>
                    </div>
                </div>
            ),
        },
        {
            id: "customize",
            label: "Chat Customization",
            icon: <EditOutlined />,
            content: (
                <div className={styles.sectionContent}>
                    <button className={styles.customizeBtn}>🔔 Mute Notifications</button>
                    <button className={styles.customizeBtn}>🎨 Change Chat Color</button>
                    <button className={styles.customizeBtn}>⭐ Mark as Favorite</button>
                </div>
            ),
        },
        mediaSection,
        {
            id: "privacy",
            label: "Privacy & Support",
            icon: <BellOutlined />,
            content: (
                <div className={styles.sectionContent}>
                    <button className={styles.customizeBtn} style={{ color: "#ff4d4f" }}>
                        🚫 Block User
                    </button>
                    <button className={styles.customizeBtn} style={{ color: "#ff4d4f" }}>
                        🗑️ Delete Chat History
                    </button>
                    <button className={styles.customizeBtn}>⚠️ Report User</button>
                </div>
            ),
        },
    ];

    const currentSections = isGroup ? groupSections : personalSections;

    return (
        <div className={styles.sidebar}>
            <button className={styles.closeBtn} onClick={onClose}>
                ×
            </button>

            <div className={styles.profileSection}>
                {isGroup ? (
                    <GroupAvatar members={conversation?.memberAvatars || conversation?.participants} size={64} />
                ) : (
                    <Avatar
                        size={64}
                        src={conversation?.avatarPath || conversation?.avatar_path}
                        style={{ backgroundColor: "#1890ff" }}
                    >
                        {!conversation?.avatarPath && !conversation?.avatar_path && conversation?.name
                            ? getFirstLetterOfEachWord(conversation.name).children
                            : "U"}
                    </Avatar>
                )}
                <h3 className={styles.profileName}>{conversation?.name}</h3>
                <p className={styles.encryptionStatus}>
                    {isGroup ? `${participants.length} members` : "Personal conversation"}
                </p>
            </div>

            <div className={styles.menuSections}>
                {currentSections.map((item) => (
                    <div
                        key={item.id}
                        className={`${styles.menuItem} ${expandedSection === item.id ? styles.expanded : ""}`}
                    >
                        <button className={styles.menuItemHeader} onClick={() => toggleSection(item.id)}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {item.icon}
                                <span className={styles.menuItemLabel}>{item.label}</span>
                            </div>
                            <RightOutlined className={styles.expandIcon} />
                        </button>
                        {expandedSection === item.id && item.content}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChatSidebar;
