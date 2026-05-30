import React from "react";
import styles from "./ChatPage.module.css";
import Sidebar from "@components/Chat/Sidebar";
import ChatWindow from "@components/Chat/ChatWindow";

const ChatPage = () => {
    return (
        <div className={styles.chatPage}>
            <div className={styles.sidebarWrapper}>
                <Sidebar />
            </div>
            <div className={styles.chatWrapper}>
                <ChatWindow />
            </div>
        </div>
    );
};

export default ChatPage;
