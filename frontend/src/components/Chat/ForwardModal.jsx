import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Modal, Input, List, Avatar, Button, message } from "antd";
import { SearchOutlined, ForwardOutlined } from "@ant-design/icons";
import { forwardMessage } from "@features/chat/chatSlice";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";

const ForwardModal = ({ visible, onClose, messageToForward }) => {
    const dispatch = useDispatch();
    const [searchQuery, setSearchQuery] = useState("");
    const [isForwarding, setIsForwarding] = useState(false);

    const conversations = useSelector((state) =>
        state.chat.conversations.allIds.map((id) => state.chat.conversations.byId[id]).filter(Boolean)
    );

    const filteredConversations = conversations.filter((conv) =>
        conv.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleForward = async (targetConversationId) => {
        if (!messageToForward) return;

        setIsForwarding(true);
        try {
            await dispatch(
                forwardMessage({
                    conversationId: targetConversationId,
                    originalConversationId: messageToForward.conversationId,
                    messageId: messageToForward.messageId,
                })
            ).unwrap();
            message.success("Message forwarded successfully");
            onClose();
        } catch (error) {
            message.error(error || "Failed to forward message");
        } finally {
            setIsForwarding(false);
        }
    };

    return (
        <Modal
            title={
                <span>
                    <ForwardOutlined style={{ marginRight: "8px" }} />
                    Forward Message
                </span>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={400}
            bodyStyle={{ padding: "12px 0" }}
        >
            <div style={{ padding: "0 16px 12px" }}>
                <Input
                    placeholder="Search conversations..."
                    prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    allowClear
                />
            </div>

            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <List
                    dataSource={filteredConversations}
                    renderItem={(conv) => (
                        <List.Item
                            key={conv.conversationId}
                            style={{
                                padding: "8px 16px",
                                cursor: "pointer",
                                transition: "background 0.3s",
                            }}
                            className="forward-list-item"
                            onClick={() => !isForwarding && handleForward(conv.conversationId)}
                            actions={[
                                <Button
                                    type="primary"
                                    size="small"
                                    loading={isForwarding}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleForward(conv.conversationId);
                                    }}
                                >
                                    Send
                                </Button>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    <Avatar
                                        src={conv.avatar_path || conv.avatarPath}
                                        style={{ backgroundColor: "#1890ff" }}
                                    >
                                        {!conv.avatar_path && !conv.avatarPath && conv.name
                                            ? getFirstLetterOfEachWord(conv.name).children
                                            : "U"}
                                    </Avatar>
                                }
                                title={conv.name}
                                description={conv.conversationType === "group" ? "Group" : "Direct Message"}
                            />
                        </List.Item>
                    )}
                />
            </div>
            <style>{`
                .forward-list-item:hover {
                    background-color: #f5f5f5;
                }
            `}</style>
        </Modal>
    );
};

export default ForwardModal;
