import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Modal, Input, List, Avatar, Button, message } from "antd";
import { searchUsers, addMembersToGroup, addMessage } from "@features/chat/chatSlice";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";

const AddMembersModal = ({ visible, onClose, conversation, participants, onMembersAdded }) => {
    const dispatch = useDispatch();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);

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

            // Call callback to refresh conversation data
            if (onMembersAdded) {
                onMembersAdded();
            }
            handleClose();
        } catch (error) {
            message.error(error || "Failed to add members");
        } finally {
            setIsAddingMembers(false);
        }
    };

    const handleClose = () => {
        setSelectedUsers([]);
        setSearchQuery("");
        setSearchResults([]);
        onClose();
    };

    if (!conversation) return null;

    return (
        <Modal
            title="Add Members to Group"
            open={visible}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
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

            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: "4px" }}>
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
                                            {getFirstLetterOfEachWord(user.fullname || user.username || "U").children}
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
    );
};

export default AddMembersModal;
