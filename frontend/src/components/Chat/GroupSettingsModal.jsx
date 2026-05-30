import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Modal, List, Avatar, Button, Tag, Select, message, Divider, Popconfirm, Input } from "antd";
import {
    UserOutlined,
    UserAddOutlined,
    DeleteOutlined,
    CrownOutlined,
    LogoutOutlined,
    ExclamationCircleOutlined,
    EditOutlined,
} from "@ant-design/icons";
import {
    updateMemberRole,
    removeMemberFromGroup,
    disbandGroup,
    updateConversation,
    searchUsers,
    addMembersToGroup,
    loadConversations,
    addMessage,
} from "@features/chat/chatSlice";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";
import { getUserInfo } from "@helpers/cookieHelper";

const { Option } = Select;

const GroupSettingsModal = ({ visible, onClose, conversation }) => {
    const dispatch = useDispatch();
    const userInfo = getUserInfo();
    const currentUserId = userInfo?.user_id || userInfo?.id || userInfo?.sub;

    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);

    useEffect(() => {
        if (conversation) {
            setNewName(conversation.name || "");
        }
    }, [conversation]);

    if (!conversation || conversation.conversationType !== "group") return null;

    const participants = conversation.participants || [];
    const currentUserParticipant = participants.find((p) => p.user_id === currentUserId || p.userId === currentUserId);
    const isAdmin = currentUserParticipant?.role === "admin";

    const handleUpdateRole = async (memberId, role) => {
        try {
            await dispatch(
                updateMemberRole({
                    conversationId: conversation.conversationId,
                    memberId,
                    role,
                }),
            ).unwrap();
            message.success("Role updated successfully");
        } catch (error) {
            message.error(error || "Failed to update role");
        }
    };

    const handleRemoveMember = async (memberId) => {
        try {
            const memberToRemove = participants.find((p) => (p.user_id || p.userId) === memberId);
            const memberName = memberToRemove?.fullname || memberToRemove?.username || "Member";

            await dispatch(
                removeMemberFromGroup({
                    conversationId: conversation.conversationId,
                    memberId,
                }),
            ).unwrap();
            message.success("Member removed successfully");
            // The backend will broadcast the system message

        } catch (error) {
            message.error(error || "Failed to remove member");
        }
    };

    const handleDisbandGroup = async () => {
        try {
            await dispatch(disbandGroup(conversation.conversationId)).unwrap();
            message.success("Group disbanded successfully");
            onClose();
        } catch (error) {
            message.error(error || "Failed to disband group");
        }
    };

    const handleUpdateGroupName = async () => {
        if (!newName.trim() || newName === conversation.name) {
            setIsEditingName(false);
            return;
        }

        setIsLoading(true);
        try {
            await dispatch(
                updateConversation({
                    conversationId: conversation.conversationId,
                    name: newName,
                }),
            ).unwrap();
            message.success("Group name updated");
            setIsEditingName(false);
        } catch (error) {
            message.error(error || "Failed to update group name");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchUsers = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const result = await dispatch(searchUsers({ query, limit: 20 })).unwrap();
            const existingMemberIds = participants.map((p) => p.user_id || p.userId);
            const filtered = result.filter((user) => !existingMemberIds.includes(user.user_id || user.userId));
            setSearchResults(filtered);
        } catch (error) {
            message.error("Failed to search users");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddMembers = async () => {
        if (selectedUsers.length === 0) {
            message.warning("Please select at least one user to add");
            return;
        }

        setIsAddingMembers(true);
        try {
            const memberIds = selectedUsers.map((user) => user.user_id || user.userId);
            await dispatch(
                addMembersToGroup({
                    conversationId: conversation.conversationId,
                    memberIds,
                }),
            ).unwrap();
            message.success(`Added ${selectedUsers.length} member(s) successfully`);
            // The backend will broadcast the system messages


            // Refresh conversation to get updated participants
            await dispatch(loadConversations()).unwrap();
            setShowAddMembersModal(false);
            setSelectedUsers([]);
            setSearchQuery("");
            setSearchResults([]);
        } catch (error) {
            message.error(error || "Failed to add members");
        } finally {
            setIsAddingMembers(false);
        }
    };

    return (
        <Modal title="Group Settings" open={visible} onCancel={onClose} footer={null} width={500}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <Avatar
                    size={80}
                    src={conversation.avatar_path || conversation.avatarPath}
                    style={{ backgroundColor: "#1890ff", marginBottom: "12px" }}
                >
                    {getFirstLetterOfEachWord(conversation.name || "Group").children}
                </Avatar>

                {isEditingName ? (
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            style={{ width: "200px" }}
                            onPressEnter={handleUpdateGroupName}
                        />
                        <Button type="primary" onClick={handleUpdateGroupName} loading={isLoading}>
                            Save
                        </Button>
                        <Button onClick={() => setIsEditingName(false)}>Cancel</Button>
                    </div>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0 }}>{conversation.name}</h3>
                        {isAdmin && (
                            <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => setIsEditingName(true)}
                                size="small"
                            />
                        )}
                    </div>
                )}
            </div>

            <Divider orientation="left">Members ({participants.length})</Divider>

            <List
                dataSource={participants}
                renderItem={(item) => (
                    <List.Item
                        actions={
                            isAdmin && item.user_id !== currentUserId && item.userId !== currentUserId
                                ? [
                                      <Select
                                          size="small"
                                          value={item.role || "member"}
                                          onChange={(val) => handleUpdateRole(item.user_id || item.userId, val)}
                                          style={{ width: "90px" }}
                                      >
                                          <Option value="member">Member</Option>
                                          <Option value="admin">Admin</Option>
                                      </Select>,
                                      <Popconfirm
                                          title="Remove from group?"
                                          onConfirm={() => handleRemoveMember(item.user_id || item.userId)}
                                          okText="Yes"
                                          cancelText="No"
                                      >
                                          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                      </Popconfirm>,
                                  ]
                                : []
                        }
                    >
                        <List.Item.Meta
                            avatar={
                                <Avatar src={item.avatar_path || item.avatarPath}>
                                    {getFirstLetterOfEachWord(item.fullname || item.username || "U").children}
                                </Avatar>
                            }
                            title={
                                <span>
                                    {item.fullname || item.username}{" "}
                                    {item.user_id === currentUserId || item.userId === currentUserId ? "(You)" : ""}
                                    {item.role === "admin" && (
                                        <Tag color="gold" style={{ marginLeft: "8px" }}>
                                            <CrownOutlined /> Admin
                                        </Tag>
                                    )}
                                </span>
                            }
                        />
                    </List.Item>
                )}
            />

            {isAdmin && (
                <>
                    <Divider />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Popconfirm
                            title="Are you sure you want to disband this group? All members will be removed and the history will be archived."
                            onConfirm={handleDisbandGroup}
                            icon={<ExclamationCircleOutlined style={{ color: "red" }} />}
                            okText="Disband"
                            okType="danger"
                        >
                            <Button type="primary" danger icon={<LogoutOutlined />}>
                                Disband Group
                            </Button>
                        </Popconfirm>

                        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setShowAddMembersModal(true)}>
                            Invite Members
                        </Button>
                    </div>
                </>
            )}

            {/* Add Members Modal */}
            <Modal
                title="Add Members to Group"
                open={showAddMembersModal}
                onCancel={() => {
                    setShowAddMembersModal(false);
                    setSelectedUsers([]);
                    setSearchQuery("");
                    setSearchResults([]);
                }}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            setShowAddMembersModal(false);
                            setSelectedUsers([]);
                            setSearchQuery("");
                            setSearchResults([]);
                        }}
                    >
                        Cancel
                    </Button>,
                    <Button key="submit" type="primary" loading={isAddingMembers} onClick={handleAddMembers}>
                        Add Selected ({selectedUsers.length})
                    </Button>,
                ]}
                width={600}
            >
                <div style={{ marginBottom: "16px" }}>
                    <Input
                        placeholder="Search users by name or username..."
                        value={searchQuery}
                        onChange={(e) => handleSearchUsers(e.target.value)}
                        loading={isSearching}
                        style={{ marginBottom: "16px" }}
                    />
                </div>

                <div
                    style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: "4px" }}
                >
                    {searchResults.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
                            {searchQuery ? "No users found" : "Search for users to add"}
                        </div>
                    ) : (
                        <List
                            dataSource={searchResults}
                            renderItem={(user) => (
                                <List.Item
                                    style={{
                                        padding: "8px 16px",
                                        backgroundColor: selectedUsers.some(
                                            (u) => (u.user_id || u.userId) === (user.user_id || user.userId),
                                        )
                                            ? "#e6f7ff"
                                            : "transparent",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        const userId = user.user_id || user.userId;
                                        if (selectedUsers.some((u) => (u.user_id || u.userId) === userId)) {
                                            setSelectedUsers(
                                                selectedUsers.filter((u) => (u.user_id || u.userId) !== userId),
                                            );
                                        } else {
                                            setSelectedUsers([...selectedUsers, user]);
                                        }
                                    }}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar src={user.avatar_path || user.avatarPath}>
                                                {
                                                    getFirstLetterOfEachWord(user.fullname || user.username || "U")
                                                        .children
                                                }
                                            </Avatar>
                                        }
                                        title={user.fullname || user.username}
                                        description={user.email}
                                    />
                                    <div style={{ marginLeft: "auto" }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.some(
                                                (u) => (u.user_id || u.userId) === (user.user_id || user.userId),
                                            )}
                                            onChange={() => {}}
                                        />
                                    </div>
                                </List.Item>
                            )}
                        />
                    )}
                </div>
            </Modal>
        </Modal>
    );
};

export default GroupSettingsModal;
