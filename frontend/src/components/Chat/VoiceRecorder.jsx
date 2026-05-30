import React, { useEffect, useRef } from "react";
import styles from "./VoiceRecorder.module.css";
import { PauseCircle } from "@mui/icons-material";

const VoiceRecorder = ({
    isRecording,
    recordingTime,
    recordedBlob,
    formatTime,
    onStartRecord,
    onStopRecord,
    onCancelRecord,
    onSendRecord,
    onClearRecord,
    error,
}) => {
    const audioRef = useRef(null);

    // Create audio URL when blob is available
    useEffect(() => {
        if (recordedBlob && audioRef.current) {
            const url = URL.createObjectURL(recordedBlob);
            audioRef.current.src = url;

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [recordedBlob]);

    if (error) {
        return (
            <div className={styles.voiceRecorderContainer}>
                <div className={styles.errorMessage}>
                    <span>⚠️ {error}</span>
                </div>
            </div>
        );
    }

    if (isRecording) {
        return (
            <div className={styles.voiceRecorderContainer}>
                <div className={styles.recordingIndicator}>
                    <span className={styles.recordingDot}></span>
                    <span className={styles.recordingText}>Recording...</span>
                    <span className={styles.recordingTime}>{formatTime(recordingTime)}</span>
                </div>
                <div className={styles.recordingActions}>
                    <button className={styles.cancelBtn} onClick={onCancelRecord} title="Cancel recording">
                        ✕
                    </button>
                    <button className={styles.stopBtn} onClick={onStopRecord} title="Stop recording">
                        <PauseCircle />
                    </button>
                </div>
            </div>
        );
    }

    if (recordedBlob) {
        return (
            <div className={styles.voiceRecorderContainer}>
                <div className={styles.playbackSection}>
                    <audio ref={audioRef} controls autoPlay className={styles.audioPlayer} />
                </div>
                <div className={styles.playbackActions}>
                    <button className={styles.deleteBtn} onClick={onClearRecord} title="Cancel">
                        Cancel
                    </button>
                    <button className={styles.sendBtn} onClick={onSendRecord} title="Send recording">
                        Send
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.voiceRecorderContainer}>
            <button className={styles.recordBtn} onClick={onStartRecord} title="Record voice message">
                Record
            </button>
        </div>
    );
};

export default VoiceRecorder;
