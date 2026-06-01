import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button, Avatar, Space, Tooltip, Alert } from "antd";
import { 
    PhoneOutlined, 
    VideoCameraOutlined, 
    AudioOutlined, 
    AudioMutedOutlined,
    EyeInvisibleOutlined,
    SyncOutlined,
    FullscreenOutlined,
    UserOutlined
} from "@ant-design/icons";
import styles from "./CallWindow.module.css";
import useAudioLevel from "@hooks/useAudioLevel";
import MicrophoneReaction from "./MicrophoneReaction";
import { getUserInfo } from "@helpers/cookieHelper";

const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const AudioVisualization = ({ stream }) => {
    const canvasRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            analyserRef.current = analyser;
            analyser.fftSize = 256;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            const draw = () => {
                animationRef.current = requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const barWidth = (canvas.width / dataArray.length) * 2.5;
                let x = 0;

                for (let i = 0; i < dataArray.length; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const hue = (i / dataArray.length) * 360;
                    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            };

            draw();

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
            };
        } catch (error) {}
    }, [stream]);

    return <canvas ref={canvasRef} className={styles.audioVisualization} width={300} height={100} />;
};

const CallWindow = ({ 
    callState, 
    userId: userIdProp,
    onEndCall, 
    isIncomingMode = false, 
    onAcceptVO, 
    onAcceptVideo, 
    onReject, 
    onRetry,
    onToggleAudio,
    onToggleVideo
}) => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const [audioError, setAudioError] = useState(null);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);
    
    const userInfo = getUserInfo();
    const userId = userIdProp || userInfo?.userId || userInfo?.id || userInfo?.sub;

    const localAudioLevel = useAudioLevel(callState?.localStream, 50);

    const getDisplayName = (name) => {
        if (!name) return "User";
        if (/^\d{10,}$/.test(name)) {
            return "Unknown User";
        }
        return name;
    };

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = callState.localStream || null;
        }
    }, [callState.localStream]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = callState.remoteStream || null;
        }
    }, [callState.remoteStream]);

    useEffect(() => {
        if (!remoteAudioRef.current || !callState.remoteStream) {
            return;
        }

        const audioTracks = callState.remoteStream?.getAudioTracks?.() || [];

        if (audioTracks.length === 0) {
            setAudioError("No audio tracks received. Check remote user's microphone.");
            return;
        }

        audioTracks.forEach((track) => {
            if (!track.enabled) {
                track.enabled = true;
            }
        });

        remoteAudioRef.current.srcObject = callState.remoteStream;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;

        const playAudio = async () => {
            try {
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.autoplay = true;

                    const playPromise = remoteAudioRef.current.play();
                    if (playPromise !== undefined) {
                        await playPromise;
                        setAudioError(null);
                    }
                }
            } catch (err) {
                if (err.name === "NotAllowedError") {
                    setAudioError("Click anywhere on the page to enable audio playback");
                } else {
                    setAudioError(`Audio playback failed: ${err.message}`);
                }
            }
        };

        const timeoutId = setTimeout(playAudio, 100);
        return () => clearTimeout(timeoutId);
    }, [callState.remoteStream, callState.callType]);

    useEffect(() => {
        if (callState.error?.includes("audio") || callState.error?.includes("media")) {
            setAudioError(callState.error);
        }
    }, [callState.error]);

    const retryAudioPlayback = useCallback(async () => {
        if (!remoteAudioRef.current) return;

        try {
            setIsAudioBlocked(false);
            await remoteAudioRef.current.play();
            setAudioError(null);
        } catch (err) {
            setAudioError(`Failed to resume audio: ${err.message}`);
        }
    }, []);

    if (isIncomingMode && callState.incomingCall && !callState.inCall) {
        const incoming = callState.incomingCall;
        const avatarSrc = incoming.isGroupCall ? incoming.groupAvatar : incoming.fromUserAvatar;
        const displayName = incoming.isGroupCall
            ? getDisplayName(incoming.groupName)
            : getDisplayName(incoming.fromUserName);

        return (
            <div className={styles.incomingCallContainer}>
                <div className={styles.incomingCallContent}>
                    <div className={styles.userProfile}>
                        <Avatar
                            size={90}
                            src={avatarSrc}
                            style={{ backgroundColor: "#7b2fff", fontSize: 36, zIndex: 2, position: "relative" }}
                        >
                            {!avatarSrc && (displayName?.charAt(0).toUpperCase() || "U")}
                        </Avatar>
                        <div className={styles.ringRipple} />
                    </div>
                    <h2 className={styles.userName}>{displayName}</h2>
                    {incoming.isGroupCall && (
                        <p className={styles.callerSubtitle}>
                            {getDisplayName(incoming.fromUserName)} is calling...
                        </p>
                    )}
                    <p className={styles.callTypeLabel}>
                        {incoming.isGroupCall ? "👥 Group " : ""}
                        {incoming.callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
                    </p>

                    <Space size={32} style={{ marginTop: "36px" }}>
                        <Tooltip title="Reject">
                            <Button
                                danger
                                shape="circle"
                                size="large"
                                icon={<PhoneOutlined rotate={135} />}
                                onClick={onReject}
                                className={styles.rejectBtn}
                            />
                        </Tooltip>
                        <Tooltip title="Accept">
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                className={styles.acceptBtn}
                                icon={incoming.callType === "video" ? <VideoCameraOutlined /> : <PhoneOutlined />}
                                onClick={() => {
                                    if (incoming.callType === "video") {
                                        onAcceptVideo();
                                    } else {
                                        onAcceptVO();
                                    }
                                }}
                            />
                        </Tooltip>
                    </Space>
                </div>
            </div>
        );
    }

    const allParticipants = [
        {
            userId: userId,
            name: "You",
            avatar: userInfo?.avatarPath || userInfo?.avatar_path,
            isLocal: true,
            stream: callState.localStream,
            isCameraOff: callState.isCameraOff
        },
        ...(callState.participants || [])
            .filter(p => {
            const isMe = String(p.userId) === String(userId);
            return !isMe;
        })
            .map(p => ({
                ...p,
                stream: p.stream || (String(p.userId) === String(callState.remoteUserId) ? callState.remoteStream : null)
            }))
    ];

    if (callState.inCall) {
        return (
            <div className={styles.callContainer}>
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    controls={false}
                    crossOrigin="anonymous"
                    playsInline
                    muted={false}
                    style={{ display: "none" }}
                />
                <div className={styles.remoteVideoContainer}>
                    <div className={`${styles.groupCallGrid} ${allParticipants.length === 1 ? styles.single : ""}`}>
                        {allParticipants.map((participant) => (
                            <div 
                                key={participant.userId} 
                                className={`${styles.participantItem} ${participant.isLocal ? styles.local : ""}`}
                            >
                                {participant.isLocal ? (
                                    (participant.isCameraOff ? (<div className={styles.participantInfo}>
                                    <Avatar size={100} src={participant.avatar} icon={<UserOutlined />}>
                                        {participant.name?.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <p className={styles.participantName}>{participant.name}</p>
                                </div>) : (<video 
                                        ref={localVideoRef} 
                                        autoPlay 
                                        playsInline 
                                        muted 
                                        className={styles.participantVideo} 
                                        style={{ transform: "scaleX(-1)" }} 
                                    />))
                                ) : (
                                    (<>
                                        {participant.stream && callState.callType === "video" ? (
                                            <video 
                                                autoPlay 
                                                playsInline 
                                                muted={true}
                                                className={styles.participantVideo}
                                                ref={el => { if (el) el.srcObject = participant.stream; }}
                                            />
                                        ) : (
                                            <div className={styles.participantInfo}>
                                                <Avatar size={100} src={participant.avatar} icon={<UserOutlined />}>
                                                    {participant.name?.charAt(0).toUpperCase()}
                                                </Avatar>
                                                <p className={styles.participantName}>{participant.name}</p>
                                            </div>
                                        )}
                                    </>)
                                )}
                                <div className={styles.participantLabel}>
                                    {participant.name} {participant.isLocal && "(You)"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {}
                <div className={styles.callControls}>
                    <div className={styles.callInfoGroup}>
                        <span className={styles.callStatusIndicator}></span>
                        <span className={styles.callInfo}>
                            {callState.callType === "video" ? "📹 Video Call" : "📞 Voice Call"} •{" "}
                            {formatDuration(callState.callDuration)}
                        </span>
                    </div>

                    <div className={styles.mainControls}>
                        <Tooltip title={callState.isMuted ? "Unmute" : "Mute"}>
                            <Button
                                shape="circle"
                                size="large"
                                icon={callState.isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                                onClick={onToggleAudio}
                                className={`${styles.controlBtn} ${callState.isMuted ? styles.active : ""}`}
                            />
                        </Tooltip>

                        {callState.callType === "video" && (
                            <Tooltip title={callState.isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
                                <Button
                                    shape="circle"
                                    size="large"
                                    icon={callState.isCameraOff ? <EyeInvisibleOutlined /> : <VideoCameraOutlined />}
                                    onClick={onToggleVideo}
                                    className={`${styles.controlBtn} ${callState.isCameraOff ? styles.active : ""}`}
                                />
                            </Tooltip>
                        )}

                        <Tooltip title="End Call">
                            <Button
                                danger
                                type="primary"
                                shape="circle"
                                size="large"
                                icon={<PhoneOutlined rotate={135} />}
                                onClick={onEndCall}
                                className={styles.endCallBtn}
                            />
                        </Tooltip>
                    </div>

                    <div className={styles.extraControls}>
                        <Tooltip title="Fullscreen">
                            <Button shape="circle" icon={<FullscreenOutlined />} className={styles.ghostBtn} />
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    }

    if (callState.outgoingCallId && !callState.inCall) {
        if (callState.isGroupCall) {
            return (
                <div className={styles.callContainer}>
                    <div className={styles.remoteVideoContainer}>
                        <div className={`${styles.groupCallGrid} ${allParticipants.length === 1 ? styles.single : ""}`}>
                            {allParticipants.map((participant) => (
                                <div 
                                    key={participant.userId} 
                                    className={`${styles.participantItem} ${participant.isLocal ? styles.local : styles.waiting}`}
                                >
                                    {participant.isLocal ? (
                                        participant.isCameraOff ? (
                                            <div className={styles.participantInfo}>
                                                <Avatar size={100} src={participant.avatar} icon={<UserOutlined />}>
                                                    {participant.name?.charAt(0).toUpperCase()}
                                                </Avatar>
                                                <p className={styles.participantName}>{participant.name}</p>
                                            </div>
                                        ) : (
                                            <video 
                                                ref={localVideoRef} 
                                                autoPlay 
                                                playsInline 
                                                muted 
                                                className={styles.participantVideo} 
                                                style={{ transform: "scaleX(-1)" }} 
                                            />
                                        )
                                    ) : (
                                        <div className={styles.participantInfo}>
                                            <Avatar size={100} src={participant.avatar} icon={<UserOutlined />}>
                                                {participant.name?.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <p className={styles.participantName}>{participant.name}</p>
                                            <div className={styles.statusTag}>Calling...</div>
                                        </div>
                                    )}
                                    <div className={styles.participantLabel}>
                                        {participant.name} {participant.isLocal && "(You)"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={styles.callControls}>
                        <div className={styles.callInfoGroup}>
                            <span className={`${styles.callStatusIndicator} ${styles.dialing}`}></span>
                            <span className={styles.callInfo}>Calling Group...</span>
                        </div>
                        <div className={styles.mainControls}>
                            <Tooltip title="Cancel Call">
                                <Button
                                    danger
                                    type="primary"
                                    shape="circle"
                                    size="large"
                                    icon={<PhoneOutlined rotate={135} />}
                                    onClick={onEndCall}
                                    className={styles.endCallBtn}
                                />
                            </Tooltip>
                        </div>
                        <div className={styles.extraControls}></div>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.outgoingCallContainer}>
                {callState.callType === "video" && callState.localStream && (
                    <div className={styles.previewBackground}>
                        <video ref={localVideoRef} autoPlay playsInline muted className={styles.fullPreview} />
                    </div>
                )}
                <div className={styles.outgoingCallContent}>
                    {callState.error && (
                        <Alert
                            message="Call Failed"
                            description={callState.error}
                            type="error"
                            showIcon
                            style={{ marginBottom: "20px", width: "100%", borderRadius: "12px" }}
                        />
                    )}

                    <div className={styles.userProfile}>
                        <Avatar size={100} className={styles.profileAvatar}>
                            {getDisplayName(callState.remoteUserName)?.charAt(0).toUpperCase() || "U"}
                        </Avatar>
                        <div className={styles.ringRipple}></div>
                    </div>

                    <h2 className={styles.userName}>
                        {callState.error ? "Call Failed" : `Calling ${getDisplayName(callState.remoteUserName)}...`}
                    </h2>
                    <p className={styles.callTypeLabel}>
                        {callState.callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
                    </p>

                    {!callState.error && (
                        <div className={styles.dialingAnimation}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    )}

                    <Space style={{ marginTop: "40px" }} size="middle">
                        {callState.callType === "video" && (
                             <Tooltip title={callState.isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
                                <Button
                                    shape="circle"
                                    size="large"
                                    icon={callState.isCameraOff ? <EyeInvisibleOutlined /> : <VideoCameraOutlined />}
                                    onClick={onToggleVideo}
                                    className={`${styles.controlBtn} ${callState.isCameraOff ? styles.active : ""}`}
                                />
                            </Tooltip>
                        )}
                        <Tooltip title={callState.isMuted ? "Unmute" : "Mute"}>
                            <Button
                                shape="circle"
                                size="large"
                                icon={callState.isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                                onClick={onToggleAudio}
                                className={`${styles.controlBtn} ${callState.isMuted ? styles.active : ""}`}
                            />
                        </Tooltip>
                        <Tooltip title="Cancel">
                            <Button 
                                danger 
                                type="primary" 
                                shape="circle" 
                                size="large" 
                                icon={<PhoneOutlined rotate={135} />} 
                                onClick={onEndCall} 
                                className={styles.endCallBtn}
                            />
                        </Tooltip>
                        
                        {callState.error && onRetry && (
                            <Button type="primary" onClick={onRetry} className={styles.retryBtn}>
                                Retry Call
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
        );
    }

    return null;
};

export default CallWindow;
