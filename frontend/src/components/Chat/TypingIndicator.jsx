import React from "react";
import styles from "./ChatWindow.module.css";

const TypingIndicator = ({ users = [] }) => {
    if (!users || users.length === 0) return null;

    const displayText =
        users.length === 1
            ? `${users[0]} is typing...`
            : `${users.slice(0, 2).join(", ")} ${users.length > 2 ? `and ${users.length - 2} more` : ""} are typing...`;

    return (
        <div className={styles.typingIndicator}>
            <span>{displayText}</span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
        </div>
    );
};

export default TypingIndicator;
