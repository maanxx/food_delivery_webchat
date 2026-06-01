import React from "react";
import styles from "./ChatPage.module.css";
import Sidebar from "@components/Chat/Sidebar";
import ChatWindow from "@components/Chat/ChatWindow";
import AppNav from "@components/Navigation/AppNav";
import DirectoryPanel from "@components/Chat/DirectoryPanel";
import { CallProvider } from "@contexts/CallContext";
import { useParams } from "react-router-dom";

const ChatPage = () => {
    const { conversationId } = useParams();

    return (
        <CallProvider>
            <div className={styles.chatPage}>
                <AppNav />
                
                <div className={`${styles.sidebarWrapper} ${conversationId ? styles.hiddenOnMobile : ''}`}>
                    <Sidebar />
                </div>
                
                <div className={`${styles.chatWrapper} ${!conversationId ? styles.hiddenOnMobile : ''}`}>
                    <ChatWindow />
                </div>

                {conversationId && (
                    <DirectoryPanel conversationId={conversationId} />
                )}
            </div>
        </CallProvider>
    );
};

export default ChatPage;
