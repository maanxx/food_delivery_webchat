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

// Audio visualization component for voice calls
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
        } catch (error) {
            console.error("Failed to set up audio visualization:", error);
        }
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

    // Phát hiện mức âm thanh từ local stream
    const localAudioLevel = useAudioLevel(callState?.localStream, 50);

    // console.log("🎬 [CallWindow] RENDER - callState:", {
    //     inCall: callState?.inCall,
    //     callType: callState?.callType,
    //     hasRemoteStream: !!callState?.remoteStream,
    //     remoteStreamId: callState?.remoteStream?.id,
    //     remoteStreamTracks: callState?.remoteStream?.getTracks?.()?.length || 0,
    // });

    // Helper function to get display name (not ID)
    const getDisplayName = (name) => {
        if (!name) return "User";
        // Only return "Unknown User" if the name is strictly numeric and long
        // Group names or usernames might contain numbers, so we should be careful
        if (/^\d{10,}$/.test(name)) {
            return "Unknown User";
        }
        return name;
    };

    // Display local stream
    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = callState.localStream || null;
        }
    }, [callState.localStream]);

    // Display remote stream
    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = callState.remoteStream || null;
        }
    }, [callState.remoteStream]);

    // Handle remote audio for both voice and video calls
    useEffect(() => {
        if (!remoteAudioRef.current || !callState.remoteStream) {
            return;
        }

        console.log("🎧 [CallWindow] Setting up remote audio");
        console.log("   Stream:", callState.remoteStream);
        console.log("   Stream ID:", callState.remoteStream?.id);

        // Check audio tracks
        const audioTracks = callState.remoteStream?.getAudioTracks?.() || [];
        console.log("   Audio tracks count:", audioTracks.length);
        audioTracks.forEach((track, idx) => {
            console.log(`   Track ${idx}:`, {
                enabled: track.enabled,
                readyState: track.readyState,
                kind: track.kind,
            });
        });

        // Make sure audio tracks are enabled
        if (audioTracks.length === 0) {
            console.warn("⚠️ [CallWindow] NO AUDIO TRACKS in remote stream! Cannot play audio.");
            setAudioError("No audio tracks received. Check remote user's microphone.");
            return;
        }

        // Enable all audio tracks
        audioTracks.forEach((track) => {
            if (!track.enabled) {
                console.log("🔊 [CallWindow] Enabling audio track");
                track.enabled = true;
            }
        });

        // Set the stream and configure audio element
        remoteAudioRef.current.srcObject = callState.remoteStream;
        remoteAudioRef.current.volume = 1.0; // Set volume to max
        remoteAudioRef.current.muted = false; // Ensure not muted
        console.log("   Audio element configured");

        // Add a small delay to ensure the audio element is ready
        const playAudio = async () => {
            try {
                console.log("   Attempting to play audio...");
                // Remove autoPlay attribute and play manually for better control
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.autoplay = true;

                    const playPromise = remoteAudioRef.current.play();
                    if (playPromise !== undefined) {
                        await playPromise;
                        setAudioError(null);
                    }
                }
            } catch (err) {
                console.error("   Error message:", err.message);

                // Handle specific autoplay policy errors
                if (err.name === "NotAllowedError") {
                    console.warn("   ⚠️ Browser autoplay policy prevented audio playback");
                    setAudioError("Click anywhere on the page to enable audio playback");
                } else {
                    setAudioError(`Audio playback failed: ${err.message}`);
                }
            }
        };

        // Use setTimeout to ensure the audio element is in the DOM and ready
        const timeoutId = setTimeout(playAudio, 100);
        return () => clearTimeout(timeoutId);
    }, [callState.remoteStream, callState.callType]);

    // Check for audio issues
    useEffect(() => {
        if (callState.error?.includes("audio") || callState.error?.includes("media")) {
            setAudioError(callState.error);
        }
    }, [callState.error]);

    // Retry audio playback - for handling autoplay policy
    const retryAudioPlayback = useCallback(async () => {
        if (!remoteAudioRef.current) return;

        try {
            console.log("🔊 [retryAudioPlayback] Attempting to resume audio playback");
            setIsAudioBlocked(false);
            await remoteAudioRef.current.play();
            console.log("✅ [retryAudioPlayback] Audio playback resumed successfully");
            setAudioError(null);
        } catch (err) {
            console.error("❌ [retryAudioPlayback] Failed to resume audio:", err);
            setAudioError(`Failed to resume audio: ${err.message}`);
        }
    }, []);

    // Incoming call mode
    if (isIncomingMode && callState.incomingCall && !callState.inCall) {
        return (
            <div className={styles.incomingCallContainer}>
                <div className={styles.incomingCallContent}>
                    <Avatar 
                        size={80} 
                        src={callState.incomingCall.isGroupCall ? callState.incomingCall.groupAvatar : callState.incomingCall.fromUserAvatar}
                        style={{ marginBottom: "20px", backgroundColor: "#1890ff" }}
                    >
                        {!callState.incomingCall.isGroupCall && !callState.incomingCall.fromUserAvatar && 
                            (getDisplayName(callState.incomingCall.fromUserName)?.charAt(0).toUpperCase() || "U")}
                        {callState.incomingCall.isGroupCall && !callState.incomingCall.groupAvatar && 
                            (getDisplayName(callState.incomingCall.groupName)?.charAt(0).toUpperCase() || "G")}
                    </Avatar>
                    <h2>
                        {callState.incomingCall.isGroupCall 
                            ? getDisplayName(callState.incomingCall.groupName) 
                            : getDisplayName(callState.incomingCall.fromUserName)}
                    </h2>
                    <p className={styles.callTypeLabel}>
                        {callState.incomingCall.isGroupCall ? "👥 Group " : ""}
                        {callState.incomingCall.callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
                    </p>
                    {callState.incomingCall.isGroupCall && (
                        <p className={styles.callerSubtitle}>
                            {getDisplayName(callState.incomingCall.fromUserName)} is calling...
                        </p>
                    )}

                    <Space size="large" style={{ marginTop: "30px" }}>
                        <Tooltip title="Accept">
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                className={styles.acceptBtn}
                                icon={
                                    callState.incomingCall.callType === "video" ? (
                                        <VideoCameraOutlined />
                                    ) : (
                                        <PhoneOutlined />
                                    )
                                }
                                onClick={() => {
                                    if (callState.incomingCall.callType === "video") {
                                        onAcceptVideo();
                                    } else {
                                        onAcceptVO();
                                    }
                                }}
                            />
                        </Tooltip>
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
                    </Space>
                </div>
            </div>
        );
    }

    // Prepare participants list for grid view
    const allParticipants = [
        // Local user
        {
            userId: userId,
            name: "You",
            avatar: userInfo?.avatarPath || userInfo?.avatar_path,
            isLocal: true,
            stream: callState.localStream,
            isCameraOff: callState.isCameraOff,
        },
        // Remote participants
        ...(callState.participants || [])
            .filter(p => {
                const isMe = String(p.userId) === String(userId);
                if (isMe) console.log("🔍 [CallWindow] Filtering out local user from participants grid:", p.userId);
                return !isMe;
            })
            .map(p => ({
                ...p,
                // Prioritize the stream attached to the participant object (for group calls)
                // Fallback to the global remoteStream if the ID matches (for 1-on-1 calls)
                stream: p.stream || (String(p.userId) === String(callState.remoteUserId) ? callState.remoteStream : null)
            }))
    ];

    // Active call mode
    if (callState.inCall) {
        return (
            <div className={styles.callContainer}>
                {/* Audio element for remote audio */}
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    controls={false}
                    crossOrigin="anonymous"
                    playsInline
                    muted={false}
                    style={{ display: "none" }}
                />

                {/* Main Content Area - Grid Layout for all calls */}
                <div className={styles.remoteVideoContainer}>
                    <div className={`${styles.groupCallGrid} ${allParticipants.length === 1 ? styles.single : ""}`}>
                        {allParticipants.map((participant) => (
                            <div 
                                key={participant.userId} 
                                className={`${styles.participantItem} ${participant.isLocal ? styles.local : ""}`}
                            >
                                {participant.isLocal ? (
                                    /* Local Participant Rendering */
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
                                    /* Remote Participant Rendering */
                                    <>
                                        {participant.stream && callState.callType === "video" ? (
                                            <video 
                                                autoPlay 
                                                playsInline 
                                                muted={true} // Mute video element as we use dedicated audio element
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
                                    </>
                                )}
                                <div className={styles.participantLabel}>
                                    {participant.name} {participant.isLocal && "(You)"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* Call controls */}
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

    // Outgoing call waiting mode
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
                    
                    {/* Reuse call controls for canceling */}
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
                {/* For video calls, show local preview even before connection */}
                {callState.callType === "video" && callState.localStream && (
                    <div className={styles.previewBackground}>
                        <video ref={localVideoRef} autoPlay playsInline muted className={styles.fullPreview} />
                    </div>
                )}

                <div className={styles.outgoingCallContent}>
                    {/* Show error alert if there's an error */}
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
