import React, { useRef, useState, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FileImageOutlined, PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import EmojiPicker from "emoji-picker-react";

import styles from "./MessageInput.module.css";
import useWebSocket from "@hooks/useWebSocket";
import useVoiceRecorder from "@hooks/useVoiceRecorder";
import { sendMessage, setSendingMessageId, addMessage } from "@features/chat/chatSlice";
import VoiceRecorder from "./VoiceRecorder";

const MessageInput = ({ conversationId }) => {
    const dispatch = useDispatch();
    const currentUser = useSelector((state) => state.auth.user);
    const { sendMessage: emitMessage, emitTyping } = useWebSocket();
    const {
        isRecording,
        recordingTime,
        recordedBlob,
        error: recordingError,
        startRecording,
        stopRecording,
        cancelRecording,
        clearRecording,
        formatTime,
    } = useVoiceRecorder();

    const [content, setContent] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [loadingImages, setLoadingImages] = useState({});
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Handle typing indicator
    const handleInput = useCallback(
        (e) => {
            setContent(e.target.value);

            if (!isTyping) {
                setIsTyping(true);
                emitTyping({ conversationId, isTyping: true });
            }

            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                emitTyping({ conversationId, isTyping: false });
            }, 3000);
        },
        [conversationId, emitTyping, isTyping],
    );

    // Handle file selection
    const handleFileSelect = useCallback((e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setAttachments((prev) => {
            const newAttachments = [...prev, ...files];
            // Mark new images as loading
            const currentLength = prev.length;
            setLoadingImages((prevLoading) => {
                const newLoading = { ...prevLoading };
                files.forEach((file, idx) => {
                    if (file.type?.startsWith("image")) {
                        newLoading[currentLength + idx] = true;
                    }
                });
                return newLoading;
            });
            return newAttachments;
        });

        // Reset input value so users can select the same file again
        e.target.value = "";
    }, []);

    // Remove attachment
    const removeAttachment = useCallback((index) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
        setLoadingImages((prev) => {
            const newLoading = { ...prev };
            delete newLoading[index];
            return newLoading;
        });
    }, []);

    // Handle image load complete
    const handleImageLoaded = useCallback((index) => {
        setLoadingImages((prev) => {
            const newLoading = { ...prev };
            delete newLoading[index];
            return newLoading;
        });
    }, []);

    // Handle emoji selection
    const handleEmojiClick = useCallback((emojiObject) => {
        setContent((prev) => prev + emojiObject.emoji);
        // Keep picker open for selecting more emojis
        // Focus back to textarea
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    }, []);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showEmojiPicker]);

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    // Auto-focus textarea after sending message (when content becomes empty)
    useEffect(() => {
        if (content === "" && !isSending && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [content, isSending]);

    // Reset state when conversation changes
    useEffect(() => {
        setIsSending(false);
        setContent("");
        setAttachments([]);
        setIsTyping(false);
        setShowVoiceRecorder(false);
        clearRecording();
    }, [conversationId, clearRecording]);

    // Send message
    const handleSendMessage = useCallback(
        async (e) => {
            e.preventDefault();

            if ((!content.trim() && attachments.length === 0) || isSending) {
                return;
            }

            setIsSending(true);
            const temporaryId = `temp-${Date.now()}`;

            // Get current user info for optimistic update from Redux state
            const senderId = currentUser?.sub || currentUser?.user_id || currentUser?.userId || currentUser?.id;

            const messageContent = content.trim();
            const messageType =
                attachments.length > 0 ? (attachments[0].type?.startsWith("image") ? "image" : "file") : "text";

            try {
                // 🚀 OPTIMISTIC UPDATE - Add message to UI immediately
                const optimisticMessage = {
                    messageId: temporaryId,
                    conversationId,
                    senderId,
                    senderName: currentUser?.name || currentUser?.username || "You",
                    senderAvatar: currentUser?.avatar || currentUser?.avatarPath || currentUser?.avatar_path,
                    content: messageContent,
                    type: messageType,
                    createdAt: new Date().toISOString(),
                    status: "sending",
                    isRead: true,
                    attachments: attachments,
                };

                dispatch(addMessage({ conversationId, message: optimisticMessage }));

                // Reset input immediately (better UX)
                setContent("");
                setAttachments([]);
                setIsTyping(false);
                emitTyping({ conversationId, isTyping: false });

                // Dispatch async thunk to send to server
                const result = await dispatch(
                    sendMessage({
                        conversationId,
                        content: messageContent,
                        type: messageType,
                        files: attachments,
                    }),
                ).unwrap();

                // Emit via WebSocket for real-time delivery to others with COMPLETE message data
                // The result contains the full message with attachment URLs from the server
                if (result && result.message) {
                    console.log("📤 Emitting message via WebSocket:", {
                        messageId: result.message.messageId,
                        type: messageType,
                        hasAttachments: !!result.message.attachments?.length,
                        attachmentCount: result.message.attachments?.length || 0,
                    });
                    emitMessage({
                        conversationId,
                        messageId: result.message.messageId,
                        senderId: result.message.senderId,
                        senderName: result.message.senderName,
                        senderAvatar: result.message.senderAvatar,
                        content: result.message.content || messageContent,
                        type: messageType,
                        attachments: result.message.attachments || [], // Contains fileUrl from server
                        createdAt: result.message.createdAt,
                        status: result.message.status || "sent",
                        temporaryId,
                    });
                } else {
                    console.warn("⚠️ Message result missing:", result);
                }
            } catch (error) {
                console.error("Failed to send message:", error);
            } finally {
                setIsSending(false);
            }
        },
        [content, attachments, conversationId, dispatch, isSending, emitMessage, emitTyping, currentUser],
    );

    // Send voice message
    const handleSendVoiceMessage = useCallback(async () => {
        if (!recordedBlob) {
            return;
        }

        try {
            setIsSending(true);
            const temporaryId = `temp-${Date.now()}`;

            // Get current user info from Redux
            const senderId = currentUser?.sub || currentUser?.user_id || currentUser?.userId || currentUser?.id;

            // Create a File object from the Blob
            const audioFile = new File([recordedBlob], `voice-${Date.now()}.webm`, {
                type: "audio/webm",
            });

            // 🚀 OPTIMISTIC UPDATE - Add message to UI immediately
            const optimisticMessage = {
                messageId: temporaryId,
                conversationId,
                senderId,
                senderName: currentUser?.name || currentUser?.username || "You",
                senderAvatar: currentUser?.avatar || currentUser?.avatarPath || currentUser?.avatar_path,
                content: "",
                type: "voice",
                createdAt: new Date().toISOString(),
                status: "sending",
                isRead: true,
                attachments: [
                    {
                        fileId: temporaryId,
                        fileName: audioFile.name,
                        fileSize: audioFile.size,
                        fileUrl: URL.createObjectURL(recordedBlob),
                    },
                ],
            };

            dispatch(addMessage({ conversationId, message: optimisticMessage }));

            // Send to server
            const result = await dispatch(
                sendMessage({
                    conversationId,
                    content: "",
                    type: "voice",
                    files: [audioFile],
                }),
            ).unwrap();

            // Emit via WebSocket for real-time delivery to others with COMPLETE message data
            // The result contains the full message with attachment URLs from the server
            if (result && result.message) {
                console.log("🎤 Emitting voice message via WebSocket:", {
                    messageId: result.message.messageId,
                    type: "voice",
                    hasAttachments: !!result.message.attachments?.length,
                    attachmentUrl: result.message.attachments?.[0]?.fileUrl,
                });
                emitMessage({
                    conversationId,
                    messageId: result.message.messageId,
                    senderId: result.message.senderId,
                    senderName: result.message.senderName,
                    senderAvatar: result.message.senderAvatar,
                    content: result.message.content || "",
                    type: "voice",
                    attachments: result.message.attachments || [], // Contains fileUrl from server
                    createdAt: result.message.createdAt,
                    status: result.message.status || "sent",
                    temporaryId,
                });

                // Clear recording and close recorder after successful send ✅
                clearRecording();
                setShowVoiceRecorder(false);
            } else {
                console.warn("⚠️ Voice message result missing:", result);
            }
        } catch (error) {
            console.error("Failed to send voice message:", error);
        } finally {
            setIsSending(false);
        }
    }, [recordedBlob, conversationId, dispatch, emitMessage, clearRecording]);

    // Auto-expand textarea
    const handleTextareaChange = useCallback(
        (e) => {
            handleInput(e);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
        },
        [handleInput],
    );

    return (
        <form className={styles.inputContainer} onSubmit={handleSendMessage}>
            {/* Voice Recorder */}
            {showVoiceRecorder && (
                <VoiceRecorder
                    isRecording={isRecording}
                    recordingTime={recordingTime}
                    recordedBlob={recordedBlob}
                    formatTime={formatTime}
                    onStartRecord={startRecording}
                    onStopRecord={stopRecording}
                    onCancelRecord={cancelRecording}
                    onSendRecord={handleSendVoiceMessage}
                    onClearRecord={clearRecording}
                    error={recordingError}
                />
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className={styles.attachmentsPreview}>
                    {attachments.map((file, index) => (
                        <div key={index} className={styles.attachmentItem}>
                            {file.type?.startsWith("image") ? (
                                <div className={styles.imageWrapper}>
                                    {loadingImages[index] && <div className={styles.skeleton}></div>}
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={`attachment-${index}`}
                                        className={`${styles.attachmentImage} ${
                                            loadingImages[index] ? styles.loading : styles.loaded
                                        }`}
                                        onLoad={() => handleImageLoaded(index)}
                                        onError={() => {
                                            console.error("Failed to load image:", file.name);
                                            handleImageLoaded(index);
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className={styles.attachmentFile}>
                                    <div className={styles.fileContent}>
                                        <div className={styles.fileIcon}>📎</div>
                                        <div className={styles.fileInfo}>
                                            <div className={styles.fileName}>
                                                {file.name.length > 12 ? file.name.substring(0, 12) + "..." : file.name}
                                            </div>
                                            <div className={styles.fileSize}>{formatFileSize(file.size)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                className={styles.removeBtn}
                                onClick={() => removeAttachment(index)}
                                title="Remove"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Actions */}
            <div className={styles.actionsBar}>
                <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => imageInputRef.current?.click()}
                    title="Send image"
                >
                    <FileImageOutlined />
                </button>
                <input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    accept="image/*"
                />

                <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Send file"
                >
                    <PaperClipOutlined />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />

                <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                    title="Record voice message"
                >
                    🎤
                </button>

                <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Emoji"
                >
                    😊
                </button>

                <textarea
                    ref={inputRef}
                    value={content}
                    onChange={handleTextareaChange}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                    placeholder="Type a message..."
                    className={styles.input}
                    rows={1}
                />

                <button
                    type="submit"
                    className={`${styles.actionBtn} ${styles.sendBtn}`}
                    disabled={(!content.trim() && attachments.length === 0) || isSending}
                    title="Send message"
                >
                    {isSending ? "⏳" : <SendOutlined />}
                </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <div ref={emojiPickerRef} className={styles.emojiPickerContainer}>
                    <EmojiPicker onEmojiClick={handleEmojiClick} theme="light" height={350} width="100%" />
                </div>
            )}
        </form>
    );
};

export default MessageInput;
