import React from "react";
import { MessageFilled, TeamOutlined, LockFilled } from "@ant-design/icons";
import styles from "./EmptyChat.module.css";

const EmptyChat = () => {
    return (
        <div className={styles.emptyContainer}>
            <div className={styles.illustration}>
                <div className={styles.iconWrapper}>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.6165 7.74498 18.9406L3 20.5L4.54284 16.0469C3.56847 14.8876 3 13.5015 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z"
                            stroke="#b3b9c4"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="#f8f9fa"
                        />
                    </svg>
                </div>
            </div>

            <h2 className={styles.title}>Select a chat to start</h2>

            <p className={styles.description}>
                Choose someone from your contacts to start the conversation, or create a new chat
            </p>

            <div className={styles.features}>
                <div className={styles.featureItem}>
                    <span className={styles.iconWrapperSmall} style={{ backgroundColor: '#f3f0ff', color: '#8b5cf6' }}>
                        <MessageFilled />
                    </span>
                    <span className={styles.text}>Direct messages</span>
                </div>
                <div className={styles.featureItem}>
                    <span className={styles.iconWrapperSmall} style={{ backgroundColor: '#f3f0ff', color: '#8b5cf6' }}>
                        <TeamOutlined />
                    </span>
                    <span className={styles.text}>Group chats</span>
                </div>
                <div className={styles.featureItem}>
                    <span className={styles.iconWrapperSmall} style={{ backgroundColor: '#fffbe1', color: '#f59e0b' }}>
                        <LockFilled />
                    </span>
                    <span className={styles.text}>End-to-end encrypted</span>
                </div>
            </div>

            <div className={styles.hint}>
                <strong>Select a conversation</strong> from the list to begin
            </div>
        </div>
    );
};

export default EmptyChat;
