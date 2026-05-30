import React, { useEffect, useRef, useState } from "react";
import { Button, Avatar, Space, Empty } from "antd";
import {
    PhoneOutlined,
    VideoCameraOutlined,
    AudioOutlined,
    AudioMutedOutlined,
    EyeInvisibleOutlined,
} from "@ant-design/icons";
import styles from "./GroupCallWindow.module.css";

const GroupCallWindow = ({
    callState,
    onToggleAudio,
    onToggleVideo,
    onEndCall,
    participants = [],
    isCallActive = false,
}) => {
    const [callDuration, setCallDuration] = useState(0);
    const durationIntervalRef = useRef(null);

    // Timer for call duration
    useEffect(() => {
        if (isCallActive) {
            durationIntervalRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, [isCallActive]);

    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, "0")}:${mins
                .toString()
                .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className={styles.groupCallWindow}>
            {/* Video Grid Container */}
            <div className={styles.videoGrid}>
                {participants.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Empty description="Waiting for participants..." />
                    </div>
                ) : (
                    participants.map((participant) => (
                        <div key={participant.userId} className={styles.videoTile}>
                            {participant.stream && participant.videoEnabled ? (
                                <video
                                    autoPlay
                                    playsInline
                                    muted={false}
                                    srcObject={participant.stream}
                                    className={styles.videoElement}
                                />
                            ) : (
                                <div className={styles.videoPlaceholder}>
                                    <Avatar
                                        size={80}
                                        src={participant.avatarPath || null}
                                        style={{
                                            backgroundColor: "#1890ff",
                                        }}
                                    >
                                        {participant.username ? participant.username.charAt(0).toUpperCase() : "U"}
                                    </Avatar>
                                </div>
                            )}
                            <div className={styles.participantInfo}>
                                <span className={styles.participantName}>{participant.username || "Unknown"}</span>
                                {!participant.videoEnabled && (
                                    <span className={styles.videoOffBadge}>
                                        <EyeInvisibleOutlined /> Video Off
                                    </span>
                                )}
                                {participant.audioMuted && (
                                    <span className={styles.mutedBadge}>
                                        <AudioMutedOutlined /> Muted
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Call Info */}
            <div className={styles.callInfo}>
                <h3>{callState?.conversationName || "Group Call"}</h3>
                <p className={styles.duration}>{formatDuration(callDuration)}</p>
                <p className={styles.participantCount}>{participants.length} participant(s)</p>
            </div>

            {/* Call Controls */}
            <div className={styles.controls}>
                <Space size="large">
                    <Button
                        type="primary"
                        danger={callState?.isMuted}
                        icon={callState?.isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                        onClick={onToggleAudio}
                        className={styles.controlBtn}
                    >
                        {callState?.isMuted ? "Unmute" : "Mute"}
                    </Button>

                    {callState?.callType === "video" && (
                        <Button
                            type="primary"
                            danger={callState?.isCameraOff}
                            icon={callState?.isCameraOff ? <EyeInvisibleOutlined /> : <VideoCameraOutlined />}
                            onClick={onToggleVideo}
                            className={styles.controlBtn}
                        >
                            {callState?.isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
                        </Button>
                    )}

                    <Button
                        type="primary"
                        danger
                        icon={<PhoneOutlined rotate={135} />}
                        onClick={onEndCall}
                        className={styles.endCallBtn}
                    >
                        End Call
                    </Button>
                </Space>
            </div>
        </div>
    );
};

export default GroupCallWindow;
