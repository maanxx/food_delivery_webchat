import React from "react";
import styles from "./EmptyChat.module.css";

const EmptyChat = () => {
    return (
        <div className={styles.emptyContainer}>
            <div className={styles.illustration}>
                <svg
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <circle cx="60" cy="60" r="58" fill="#f0f2f5" stroke="#e4e6eb" strokeWidth="2" />
                    <path
                        d="M35 55C35 45.611 42.611 38 52 38H68C77.389 38 85 45.611 85 55V65C85 74.389 77.389 82 68 82H42L35 88V55Z"
                        fill="#fff"
                        stroke="#e4e6eb"
                        strokeWidth="1.5"
                    />
                    <circle cx="47" cy="60" r="3" fill="#bcc0c4" />
                    <circle cx="60" cy="60" r="3" fill="#bcc0c4" />
                    <circle cx="73" cy="60" r="3" fill="#bcc0c4" />
                </svg>
            </div>

            <h2 className={styles.title}>Select a chat to start</h2>

            <p className={styles.description}>
                Choose someone from your contacts to start the conversation, or create a new chat
            </p>

            <div className={styles.features}>
                <div className={styles.featureItem}>
                    <span className={styles.icon}>💬</span>
                    <span className={styles.text}>Direct messages</span>
                </div>
                <div className={styles.featureItem}>
                    <span className={styles.icon}>👥</span>
                    <span className={styles.text}>Group chats</span>
                </div>
                <div className={styles.featureItem}>
                    <span className={styles.icon}>🔒</span>
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
