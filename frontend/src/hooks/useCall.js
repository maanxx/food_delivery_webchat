import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { getUserInfo } from "@helpers/cookieHelper";
import callService from "@services/callService";
import { getSimplePeer } from "@utils/SimplePeerShim";

const useCall = (socket) => {
    const userInfo = useSelector((state) => state.auth.user);
    const conversations = useSelector((state) => state.chat.conversations.byId);
    const userId = userInfo?.sub || userInfo?.user_id || userInfo?.userId || userInfo?.id;

    const [callState, setCallState] = useState({
        inCall: false,
        incomingCall: null,
        callId: null,
        outgoingCallId: null,
        callType: null,
        remoteUserId: null,
        remoteUserName: null,
        callDuration: 0,
        peer: null,
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isCameraOff: false,
        error: null,
        participants: [],
    });

    const peerRef = useRef(null);
    const callTimerRef = useRef(null);
    const streamRef = useRef(null);
    const remoteUserIdRef = useRef(null);
    const callIdRef = useRef(null);
    const recipientIdRef = useRef(null);
    const callStartTimeRef = useRef(null);
    const callConversationIdRef = useRef(null);
    const callTypeRef = useRef(null);
    const isCleaningUpRef = useRef(false);
    const peerReadyRef = useRef(false);
    const pendingSignalsRef = useRef([]);
    const answerRetryCountRef = useRef(0);
    const signalsProcessedRef = useRef({ offers: 0, answers: 0, iceCandidates: 0 });
    const offerProcessedRef = useRef(false);
    const localStreamRef = useRef(null);
    const isGroupCallRef = useRef(false);
    const peersRef = useRef({});
    const incomingCallRef = useRef(null);
    const conversationsRef = useRef({});

    const processPendingSignals = useCallback(() => {
        if (isCleaningUpRef.current) {
            return;
        }

        const remainingSignals = [];

        while (pendingSignalsRef.current.length > 0) {
            const signal = pendingSignalsRef.current.shift();
            const targetUserId = signal.fromUserId;

            let targetPeer = targetUserId ? peersRef.current[targetUserId] : null;
            if (!targetPeer && !targetUserId) {
                targetPeer = peerRef.current;
            }

            if (!targetPeer) {
                remainingSignals.push(signal);
                continue;
            }

            try {
                if (signal.type === "offer") {
                    if (offerProcessedRef.current && !isGroupCallRef.current) {
                        continue;
                    }

                    targetPeer.signal(signal.data);
                    if (!isGroupCallRef.current) offerProcessedRef.current = true;
                    signalsProcessedRef.current.offers++;
                } else if (signal.type === "answer") {
                    targetPeer.signal(signal.data);
                    signalsProcessedRef.current.answers++;
                } else if (signal.type === "ice") {
                    targetPeer.signal(signal.data);
                    signalsProcessedRef.current.iceCandidates++;
                } else {
                    targetPeer.signal(signal.data);
                }
            } catch (error) {
                if (answerRetryCountRef.current < 3) {
                    answerRetryCountRef.current++;
                    remainingSignals.push(signal);
                }
            }
        }

        pendingSignalsRef.current = remainingSignals;
    }, []);

    const cleanupPeers = useCallback(() => {
        Object.keys(peersRef.current).forEach(uid => {
            try {
                const peer = peersRef.current[uid];
                if (peer) {
                    setTimeout(() => {
                        try {
                            peer.destroy?.();
                        } catch (e) {}
                    }, 0);
                }
            } catch (err) {}
        });

        if (peerRef.current) {
            try {
                const isManaged = Object.values(peersRef.current).includes(peerRef.current);
                if (!isManaged) {
                    const p = peerRef.current;
                    setTimeout(() => p.destroy?.(), 0);
                }
            } catch (e) {}
        }

        peersRef.current = {};
        peerRef.current = null;
    }, []);

    const formatCallMessage = (callType, duration, status) => {
        const icon = callType === "video" ? "📹" : "📞";
        const callTypeText = callType === "video" ? "Video Call" : "Voice Call";

        if (status === "ended") {
            const formatDuration = (seconds) => {
                if (!seconds || seconds <= 0) return null;
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                if (mins > 0) {
                    return `${mins}m ${secs}s`;
                }
                return `${secs}s`;
            };
            const durationStr = formatDuration(duration);
            return durationStr ? `${icon} ${callTypeText} - ${durationStr}` : `${icon} ${callTypeText}`;
        } else if (status === "cancelled") {
            return `${icon} ${callTypeText} - Cancelled`;
        } else if (status === "missed") {
            return `${icon} ${callTypeText} - Missed`;
        } else if (status === "rejected") {
            return `${icon} ${callTypeText} - Rejected`;
        }
        return `${icon} ${callTypeText}`;
    };

    const endCall = useCallback(
        (options = {}) => {
            const { skipMessage = false } = options;

            if (isCleaningUpRef.current) {
                return;
            }
            isCleaningUpRef.current = true;

            const streamToCleanup = streamRef.current;

            cleanupPeers();

            setTimeout(() => {
                if (streamToCleanup) {
                    try {
                        if (typeof streamToCleanup.getTracks === "function") {
                            streamToCleanup.getTracks().forEach((track) => {
                                try {
                                    if (track && typeof track.stop === "function") {
                                        track.stop();
                                    }
                                } catch (trackError) {}
                            });
                        } else
                            {}
                    } catch (streamError) {}
                }
                streamRef.current = null;
            }, 50);

            try {
                setCallState((prev) => {
                    const callIdToEnd = callIdRef.current || prev.callId || prev.outgoingCallId;
                    const remoteUserId = remoteUserIdRef.current || prev.remoteUserId;
                    const conversationId = callConversationIdRef.current;
                    const callType = callTypeRef.current || prev.callType;
                    const wasInCall = prev.inCall;

                    if (callIdToEnd && socket && socket.connected) {
                        const terminationData = {
                            callId: callIdToEnd,
                            toUserId: remoteUserId,
                            conversationId: conversationId,
                            duration: wasInCall ? prev.callDuration : 0,
                        };

                        if (wasInCall) {
                            socket.emit("end_call", terminationData);
                        } else {
                            socket.emit("cancel_call", terminationData);
                            socket.emit("call_cancelled", terminationData);
                        }
                    } else {}

                    if (conversationId && callType && !skipMessage) {
                        const duration = wasInCall ? prev.callDuration : 0;
                        const status = wasInCall ? "ended" : "cancelled";

                        setTimeout(() => {
                            if (socket && socket.connected) {
                                socket.emit("save_call_message", {
                                    conversationId,
                                    content: formatCallMessage(callType, duration, status),
                                    type: "system_call",
                                    callData: {
                                        callId: callIdToEnd,
                                        callType,
                                        duration,
                                        status,
                                    },
                                });
                            }
                        }, 100);
                    }

                    return prev;
                });
            } catch (error) {}

            setCallState((prev) => ({
                ...prev,
                inCall: false,
                callId: null,
                incomingCall: null,
                outgoingCallId: null,
                remoteStream: null,
                localStream: null,
                callDuration: 0,
                callType: null,
                remoteUserId: null,
            }));

            remoteUserIdRef.current = null;
            callIdRef.current = null;
            recipientIdRef.current = null;
            callStartTimeRef.current = null;
            callConversationIdRef.current = null;
            callTypeRef.current = null;

            pendingSignalsRef.current = [];
            peerReadyRef.current = false;
            offerProcessedRef.current = false;
            signalsProcessedRef.current = { offers: 0, answers: 0, iceCandidates: 0 };
            answerRetryCountRef.current = 0;

            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }

            isCleaningUpRef.current = false;
        },
        [socket],
    );

    useEffect(() => {
        if (callState.inCall) {
            callTimerRef.current = setInterval(() => {
                setCallState((prev) => ({
                    ...prev,
                    callDuration: prev.callDuration + 1,
                }));
            }, 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
        }

        return () => {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
        };
    }, [callState.inCall]);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        if (!socket) {
            return;
        }

        socket.on("incoming_call", (data) => {
            const convId = data.conversationId || data.conversation_id || data.groupId;
            const conversation = convId ? conversationsRef.current[convId] : null;
            const isGroupCall =
                data.isGroupCall || 
                data.group_call || 
                data.type === "group" ||
                conversation?.type === "group" || 
                conversation?.conversationType === "group";

            isGroupCallRef.current = isGroupCall;
            const fromUserId = data.callerId || data.initiator_id || data.initiatorId || data.userId || data.fromUserId || data.from_user_id;
            const fromUserName = data.callerName || data.caller_name || data.initiatorName || data.fromUserName || data.userName || "User";
            const fromUserAvatar = data.callerAvatar || data.caller_avatar || data.initiatorAvatar || data.fromUserAvatar;

            const incomingData = {
                callId: data.callId || data.id,
                fromUserId,
                fromUserName,
                fromUserAvatar,
                callType: data.callType || data.call_type || "voice",
                conversationId: convId,
                timestamp: data.timestamp || Date.now(),
                isGroupCall,
                groupName: data.groupName || data.group_name || conversation?.name || fromUserName,
                groupAvatar: data.groupAvatar || data.group_avatar || conversation?.avatarPath || conversation?.avatar_path || fromUserAvatar,
                participants: [
                    {
                        userId: fromUserId,
                        name: fromUserName,
                        avatar: fromUserAvatar,
                        isInitiator: true,
                        isMuted: false,
                        isCameraOff: false,
                    },
                ],
            };

            incomingCallRef.current = incomingData;

            setCallState((prev) => ({
                ...prev,
                callId: incomingData.callId,
                isGroupCall: incomingData.isGroupCall,
                incomingCall: incomingData,
            }));
        });

        socket.on("call_accepted", (data) => {
            if (data.answer && !isCleaningUpRef.current) {
                pendingSignalsRef.current.push({
                    data: data.answer,
                    type: "answer",
                    receivedAt: Date.now(),
                });

                if (peerReadyRef.current && peerRef.current) {
                    processPendingSignals();
                }
            }

            const activeCallId = data.callId || data.id || callIdRef.current;

            if (localStreamRef.current && isGroupCallRef.current) {
                const recipientId = data.recipientId || data.userId || data.fromUserId;

                if (peersRef.current[recipientId]) {
                    try { peersRef.current[recipientId].destroy?.(); } catch(e) {}
                }

                (async () => {
                    try {
                        const peer = await createPeerConnection(
                            localStreamRef.current,
                            true,
                            activeCallId,
                            recipientId,
                        );
                        peersRef.current[recipientId] = peer;
                        if (!peerRef.current)
                            peerRef.current = peer;
                    } catch (err) {}
                })();
            }

            setCallState((prev) => {
                const newOutgoingCallId = data.callId || data.id || prev.callId || prev.outgoingCallId;

                if (!callStartTimeRef.current) {
                    callStartTimeRef.current = Date.now();
                }

                const newParticipant = {
                    userId: data.recipientId || data.userId || data.fromUserId,
                    name: data.recipientName || data.recipient_name || "User",
                    avatar: data.recipientAvatar || data.recipient_avatar,
                    isMuted: false,
                    isCameraOff: false,
                    isInitiator: false,
                };

                const isGroup = prev.isGroupCall || isGroupCallRef.current;

                return {
                    ...prev,
                    inCall: true,
                    isGroupCall: isGroup,
                    outgoingCallId: newOutgoingCallId,
                    remoteUserName: isGroup
                        ? prev.remoteUserName
                        : data.recipientName || data.recipient_name || prev.remoteUserName,
                    participants: isGroup
                        ? prev.participants.some((p) => String(p.userId) === String(newParticipant.userId))
                            ? prev.participants
                            : [...prev.participants, newParticipant]
                        : prev.participants,
                };
            });
        });

        socket.on("call_rejected", (data) => {
            endCall({ skipMessage: true });

            setCallState((prev) => ({
                ...prev,
                error: data.reason || "Call rejected by user",
            }));

            setTimeout(() => {
                setCallState((prev) => ({ ...prev, error: null }));
            }, 3000);
        });

        socket.on("cancel_call", (data) => {
            setCallState((prev) => {
                if (prev.inCall) {
                    setTimeout(() => {
                        endCall();
                    }, 0);
                }
                return {
                    ...prev,
                    incomingCall: null,
                };
            });
        });

        socket.on("call_cancelled", (data) => {
            setCallState((prev) => {
                if (prev.inCall) {
                    setTimeout(() => {
                        endCall();
                    }, 0);
                }
                return {
                    ...prev,
                    incomingCall: null,
                };
            });
        });

        socket.on("call_ended", () => {
            endCall();
        });

        socket.on("ice_candidate", (data) => {
            if (!isCleaningUpRef.current && data.candidate) {
                pendingSignalsRef.current.push({
                    data: {
                        candidate: data.candidate,
                        sdpMLineIndex: data.sdpMLineIndex !== undefined ? data.sdpMLineIndex : 0,
                        sdpMid: data.sdpMid || "0",
                    },
                    fromUserId: data.fromUserId || data.userId || data.senderId,
                    type: "ice",
                    receivedAt: Date.now(),
                });

                if (peerReadyRef.current && peerRef.current) {
                    processPendingSignals();
                }
            } else if (isCleaningUpRef.current) {} else {}
        });

        socket.on("offer", (data) => {
            if (!isCleaningUpRef.current && data.offer) {
                pendingSignalsRef.current.push({
                    data: data.offer,
                    fromUserId: data.fromUserId || data.userId || data.callerId || data.initiatorId,
                    type: "offer",
                    receivedAt: Date.now(),
                });

                if (peerReadyRef.current && peerRef.current) {
                    processPendingSignals();
                }
            } else if (isCleaningUpRef.current) {} else {}
        });

        socket.on("answer", (data) => {
            if (!isCleaningUpRef.current) {
                if (data.answer) {
                    pendingSignalsRef.current.push({
                        data: data.answer,
                        fromUserId: data.fromUserId || data.userId || data.recipientId,
                        type: "answer",
                        receivedAt: Date.now(),
                    });
                } else {}

                if (peerReadyRef.current && peerRef.current) {
                    processPendingSignals();
                } else
                    {}
            } else
                if (isCleaningUpRef.current) {}
        });

        const originalOn = socket.on.bind(socket);
        const handledEvents = new Set([
            "incoming_call",
            "call_accepted",
            "call_rejected",
            "cancel_call",
            "call_cancelled",
            "call_ended",
            "ice_candidate",
            "offer",
            "answer",
            "connect",
            "disconnect",
            "reconnect",
        ]);

        socket.on = function (eventName, handler) {
            return originalOn(eventName, handler);
        };

        socket.onAny?.((eventName, data) => {
            if (!handledEvents.has(eventName) && eventName.includes("call")) {}
        });

        return () => {
            socket.off("incoming_call");
            socket.off("call_accepted");
            socket.off("call_rejected");
            socket.off("cancel_call");
            socket.off("call_cancelled");
            socket.off("call_ended");
            socket.off("ice_candidate");
            socket.off("offer");
            socket.off("answer");
        };
    }, [socket, endCall]);

    const getMediaStream = useCallback(async (type = "voice") => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Your browser does not support voice/video calls");
            }

            const constraints =
                type === "video" ? { audio: true, video: { width: 1280, height: 720 } } : { audio: true };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            const audioTracksToEnable = [];
            stream.getTracks().forEach((track, idx) => {
                if (track.kind === "audio") {
                    track.enabled = true;
                    if (track.enabled) {} else {}
                    audioTracksToEnable.push(track);
                }
            });

            if (audioTracksToEnable.length > 0) {
                audioTracksToEnable.forEach((track) => {
                    if (!track.enabled) {
                        track.enabled = true;
                    } else {}
                });
            }

            setCallState((prev) => ({
                ...prev,
                localStream: stream,
                error: null,
            }));
            localStreamRef.current = stream;
            return stream;
        } catch (error) {
            if (type === "video") {
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    streamRef.current = audioStream;

                    setCallState((prev) => ({
                        ...prev,
                        localStream: audioStream,
                        callType: "video",
                        isCameraOff: true,
                        error: `Camera issue: ${error.name === "NotReadableError" ? "Already in use" : "Not found"}. Your camera is disabled, but you can see the caller's video.`,
                    }));

                    setTimeout(() => {
                        setCallState((prev) => ({ ...prev, error: null }));
                    }, 5000);

                    return audioStream;
                } catch (audioError) {}
            }

            let userFriendlyError = error.message;

            if (error.name === "NotAllowedError" || error.message?.includes("Permission denied")) {
                userFriendlyError = `${type === "video" ? "Video" : "Audio"} permission denied. Please enable camera/microphone access in browser settings.`;
            } else if (error.name === "NotFoundError" || error.message?.includes("no suitable video")) {
                userFriendlyError = `No ${type === "video" ? "camera" : "microphone"} found on your device`;
            } else if (error.name === "NotReadableError") {
                userFriendlyError = `${type === "video" ? "Camera" : "Microphone"} is already in use by another application`;
            } else if (error.message?.includes("browser")) {
                userFriendlyError = "Your browser does not support voice/video calls";
            }

            setCallState((prev) => ({
                ...prev,
                error: userFriendlyError,
            }));
            throw new Error(userFriendlyError);
        }
    }, []);

    const createPeerConnection = useCallback(
        async (stream, initiator = true, callId, recipientId) => {
            try {
                if (!stream) {
                    throw new Error("Media stream is undefined");
                }

                if (typeof stream.getTracks !== "function") {
                    throw new Error("Invalid stream object: missing getTracks method");
                }

                const tracks = stream.getTracks();
                if (tracks.length === 0) {}

                callIdRef.current = callId;
                recipientIdRef.current = recipientId;

                const capturedCallId = callId;
                const capturedRecipientId = recipientId;

                const SimplePeerClass = await getSimplePeer();

                if (typeof SimplePeerClass !== "function") {
                    throw new Error(
                        `SimplePeerClass is not a constructor. Type: ${typeof SimplePeerClass}, Value: ${SimplePeerClass}`,
                    );
                }

                let peer;
                try {
                    if (stream) {
                        const audioTracks = stream.getAudioTracks?.() || [];
                        const videoTracks = stream.getVideoTracks?.() || [];

                        audioTracks.forEach((track, idx) => {
                            track.enabled = true;
                        });

                        const stillDisabledAudioTracks = audioTracks.filter((t) => !t.enabled);
                        if (stillDisabledAudioTracks.length > 0) {} else {}
                    }

                    const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                    if (!RTCPeerConnection) {
                        throw new Error("RTCPeerConnection not available in browser");
                    }

                    peer = new SimplePeerClass({
                        initiator,
                        trickleIce: true,
                        stream,
                        config: {
                            iceServers: [
                                { urls: ["stun:stun1.l.google.com:19302"] },
                                { urls: ["stun:stun2.l.google.com:19302"] },
                                { urls: ["stun:stun3.l.google.com:19302"] },
                                { urls: ["stun:stun4.l.google.com:19302"] },
                            ],
                        },
                    });

                    if (peer._pc && callTypeRef.current === "video") {
                        const videoTracks = stream.getVideoTracks?.() || [];
                        if (videoTracks.length === 0) {
                            try {
                                if (peer._pc.addTransceiver && typeof peer._pc.addTransceiver === "function") {
                                    peer._pc.addTransceiver("video", { send: false, recv: true });
                                } else {}
                            } catch (transceiverError) {}
                        } else {}
                    }

                    if (peer._pc) {
                        if (peer._pc.getSenders && typeof peer._pc.getSenders === "function") {
                            const senders = peer._pc.getSenders();
                            if (senders.length === 0) {} else {
                                let audioSenderFound = false;
                                senders.forEach((sender, idx) => {
                                    const kind = sender.track?.kind;
                                    const enabled = sender.track?.enabled;
                                    if (kind === "audio") {
                                        audioSenderFound = true;
                                        if (!enabled) {
                                            sender.track.enabled = true;
                                        } else {}
                                    }
                                });
                                if (!audioSenderFound) {}
                            }
                        }
                    }
                } catch (peerConstructorError) {
                    throw new Error(`SimplePeer initialization failed: ${peerConstructorError.message}`);
                }

                peer.on("connect", () => {
                    peerReadyRef.current = true;
                    processPendingSignals();
                });

                peer.on("ready", () => {});

                peer.on("data", (data) => {});

                peer.on("signal", (data) => {
                    const signalCallId = capturedCallId || callIdRef.current;
                    const signalRecipientId = capturedRecipientId || recipientIdRef.current;

                    if (data.type === "answer")
                        {} else
                        {}

                    try {
                        if (!socket || !socket.connected) {
                            if (data.type === "answer") {}
                            return;
                        }

                        if (data.type === "offer") {
                            if (data.sdp && data.sdp.includes("m=audio")) {} else {}
                            socket.emit("offer", {
                                callId: signalCallId,
                                offer: data,
                                toUserId: signalRecipientId,
                                fromUserId: userId,
                            });
                        } else if (data.type === "answer") {
                            if (data.sdp && data.sdp.includes("m=audio")) {} else {}
                            socket.emit("answer", {
                                callId: signalCallId,
                                answer: data,
                                toUserId: signalRecipientId,
                                fromUserId: userId,
                            });
                        } else if (data.candidate) {
                            socket.emit("ice_candidate", {
                                callId: signalCallId,
                                candidate: data.candidate,
                                sdpMLineIndex: data.sdpMLineIndex,
                                sdpMid: data.sdpMid,
                                toUserId: signalRecipientId,
                                fromUserId: userId,
                            });
                        }
                    } catch (signalError) {}
                });

                peer.on("stream", (remoteStream) => {
                    try {
                        const tracks = remoteStream?.getTracks?.() || [];
                        const audioTracks = tracks.filter((t) => t.kind === "audio");
                        const videoTracks = tracks.filter((t) => t.kind === "video");

                        tracks.forEach((track, idx) => {
                            if (track.kind === "audio" && !track.enabled) {
                                track.enabled = true;
                            }
                        });

                        if (!remoteStream || typeof remoteStream.getTracks !== "function") {
                            return;
                        }

                        if (audioTracks.length === 0) {} else {}

                        setCallState((prev) => {
                            const participantExists = prev.participants.some(p => String(p.userId) === String(capturedRecipientId));

                            let updatedParticipants;
                            if (participantExists) {
                                updatedParticipants = prev.participants.map((p) =>
                                    String(p.userId) === String(capturedRecipientId) ? { ...p, stream: remoteStream } : p,
                                );
                            } else {
                                updatedParticipants = [
                                    ...prev.participants, 
                                    { 
                                        userId: capturedRecipientId, 
                                        stream: remoteStream, 
                                        name: `User ${capturedRecipientId}`,
                                        isMuted: false,
                                        isCameraOff: false
                                    }
                                ];
                            }

                            return {
                                ...prev,
                                remoteStream,
                                participants: updatedParticipants,
                            };
                        });
                    } catch (streamError) {}
                });

                peer.on("error", (error) => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    try {
                        setCallState((prev) => ({
                            ...prev,
                            error: `Connection error: ${error.message || error}`,
                        }));
                    } catch (stateError) {}
                });

                peer.on("close", () => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    if (!isCleaningUpRef.current) {
                        endCall();
                    } else
                        {}
                });

                setTimeout(() => {
                    if (!isCleaningUpRef.current && peerRef.current === peer) {
                        peerReadyRef.current = true;
                        if (pendingSignalsRef.current.length > 0) {}
                        processPendingSignals();
                    }
                }, 100);

                return peer;
            } catch (error) {
                setCallState((prev) => ({
                    ...prev,
                    error: `WebRTC initialization failed: ${error.message}`,
                }));
                throw error;
            }
        },
        [socket, endCall, processPendingSignals],
    );

    const makeCall = useCallback(
        async (recipientId, conversationId, callType = "voice", recipientName = "User") => {
            try {
                peerReadyRef.current = false;
                pendingSignalsRef.current = [];
                answerRetryCountRef.current = 0;
                signalsProcessedRef.current = { offers: 0, answers: 0, iceCandidates: 0 };

                setCallState((prev) => {
                    const newState = {
                        ...prev,
                        outgoingCallId: `pending_${Date.now()}`,
                        callType,
                        remoteUserId: recipientId,
                        remoteUserName: recipientName,
                        error: null,
                    };
                    return newState;
                });

                remoteUserIdRef.current = recipientId;

                let stream;
                try {
                    stream = await getMediaStream(callType);
                } catch (mediaError) {
                    const userMessage =
                        mediaError.message ||
                        `Failed to access ${callType === "video" ? "camera/microphone" : "microphone"}. Please check browser permissions.`;

                    setCallState((prev) => ({
                        ...prev,
                        error: userMessage,
                    }));
                    throw mediaError;
                }

                let callId = null;
                try {
                    const response = await callService.initiateCall(recipientId, conversationId, callType);

                    const callData = response.data?.data || response.data;

                    callId = callData.call_id || callData.callId || callData.id;
                } catch (apiError) {
                    callId = `call_${Date.now()}`;
                }

                if (callId) {
                    callIdRef.current = callId;
                    recipientIdRef.current = recipientId;
                    remoteUserIdRef.current = recipientId;
                    callConversationIdRef.current = conversationId;
                    callTypeRef.current = callType;

                    setCallState((prev) => ({
                        ...prev,
                        callId: callId,
                        outgoingCallId: callId,
                        inCall: false,
                        error: null,
                        participants: [
                            {
                                userId: recipientId,
                                name: prev.remoteUserName,
                                avatar: null,
                                isInitiator: false,
                                isMuted: false,
                                isCameraOff: false,
                            },
                        ],
                    }));
                } else
                    {}

                try {
                    if (peerRef.current) {
                        try {
                            const oldPeer = peerRef.current;
                            peerRef.current = null;
                            oldPeer.destroy?.();
                        } catch (destroyError) {
                            peerRef.current = null;
                        }
                    }

                    isGroupCallRef.current = false;
                    const peer = await createPeerConnection(stream, true, callId, recipientId);
                    peerRef.current = peer;
                    peersRef.current[recipientId] = peer;
                } catch (peerError) {
                    setCallState((prev) => ({
                        ...prev,
                        error: `Connection error: ${peerError.message || "Failed to initialize connection"}`,
                    }));
                    throw peerError;
                }
            } catch (error) {
                setCallState((prev) => ({
                    ...prev,
                    error: error.message || "Call failed",
                }));
            }
        },
        [getMediaStream, socket, userId, userInfo, createPeerConnection],
    );

    const makeGroupCall = useCallback(
        async (conversationId, callType = "voice", groupName = "Group", participantIds = []) => {
            try {
                peerReadyRef.current = false;
                pendingSignalsRef.current = [];
                answerRetryCountRef.current = 0;
                signalsProcessedRef.current = { offers: 0, answers: 0, iceCandidates: 0 };

                setCallState((prev) => ({
                    ...prev,
                    outgoingCallId: `pending_${Date.now()}`,
                    callType,
                    remoteUserId: conversationId,
                    remoteUserName: groupName,
                    isGroupCall: true,
                    error: null,
                }));

                isGroupCallRef.current = true;
                let stream;
                try {
                    stream = await getMediaStream(callType);
                } catch (mediaError) {
                    setCallState((prev) => ({ ...prev, error: mediaError.message }));
                    throw mediaError;
                }

                const response = await callService.initiateGroupCall(conversationId, callType, participantIds);
                const callData = response.data?.data || response.data;
                const callId = callData.call_id || callData.callId || callData.id;

                if (callId) {
                    callIdRef.current = callId;
                    callConversationIdRef.current = conversationId;
                    remoteUserIdRef.current = conversationId;
                    callTypeRef.current = callType;

                    setCallState((prev) => ({
                        ...prev,
                        callId: callId,
                        outgoingCallId: callId,
                        remoteUserId: conversationId,
                        isGroupCall: true,
                        participants: [],
                    }));

                    if (socket?.connected) {
                        socket.emit("group_call_initiated", {
                            callId,
                            conversationId,
                            callType,
                            initiatorId: userId,
                            participantIds,
                        });
                    }
                }

                return callId;
            } catch (error) {
                setCallState((prev) => ({ ...prev, error: error.message }));
                throw error;
            }
        },
        [getMediaStream, socket, userId],
    );

    const acceptCall = useCallback(
        async (callType = "voice") => {
            try {
                peerReadyRef.current = false;
                offerProcessedRef.current = false;
                answerRetryCountRef.current = 0;
                signalsProcessedRef.current = { offers: 0, answers: 0, iceCandidates: 0 };
                const incomingCall = incomingCallRef.current || callState.incomingCall;

                if (!incomingCall) {
                    throw new Error("No incoming call to accept");
                }

                const fromUserId = incomingCall.fromUserId;
                const incomingCallId = incomingCall.callId;
                const conversationId = incomingCall.conversationId;
                const isGroupCall = incomingCall.isGroupCall;
                const groupName = incomingCall.groupName;
                const fromUserName = incomingCall.fromUserName;

                remoteUserIdRef.current = fromUserId;

                setCallState((prev) => ({
                    ...prev,
                    inCall: true,
                    callId: incomingCallId,
                    callType,
                    isGroupCall: isGroupCall,
                    remoteUserId: fromUserId,
                    remoteUserName: isGroupCall ? groupName : fromUserName,
                    incomingCall: null,
                    error: null,
                    participants: [
                        {
                            userId: fromUserId,
                            name: isGroupCall ? groupName : fromUserName,
                            avatar: isGroupCall
                                ? incomingCall?.groupAvatar
                                : incomingCall?.fromUserAvatar,
                            isInitiator: true,
                            isMuted: false,
                            isCameraOff: false,
                        },
                    ],
                }));

                try {
                    await callService.acceptCall(incomingCallId);
                } catch (apiError) {}

                const stream = await getMediaStream(callType);

                callIdRef.current = incomingCallId;
                remoteUserIdRef.current = fromUserId;
                callConversationIdRef.current = conversationId;
                callTypeRef.current = callType;
                callStartTimeRef.current = Date.now();

                const peer = await createPeerConnection(stream, false, incomingCallId, fromUserId);
                peerRef.current = peer;
                peersRef.current[fromUserId] = peer;

                socket?.emit("accept_call", {
                    callerId: fromUserId,
                    initiatorId: fromUserId,
                    fromUserId: userId,
                    conversationId: incomingCall?.conversationId,
                    callId: incomingCallId,
                });
            } catch (error) {
                setCallState((prev) => ({
                    ...prev,
                    error: error.message,
                }));
            }
        },
        [callState.incomingCall, getMediaStream, createPeerConnection, socket],
    );

    const rejectCall = useCallback(() => {
        setCallState((prev) => {
            const callIdToReject = prev.incomingCall?.callId;
            const recipientId = prev.incomingCall?.fromUserId;
            const conversationId = prev.incomingCall?.conversationId;
            const callType = prev.incomingCall?.callType || "voice";

            if (callIdToReject) {
                callService
                    .rejectCall(callIdToReject, "user_declined")
                    .then(() => {})
                    .catch((error) => {});
            }

            socket?.emit("reject_call", {
                callerId: recipientId,
                conversationId: conversationId,
                callId: callIdToReject,
                reason: "user_declined",
            });

            if (conversationId && callType && socket && socket.connected) {
                setTimeout(() => {
                    socket.emit("save_call_message", {
                        conversationId,
                        content: formatCallMessage(callType, 0, "rejected"),
                        type: "system_call",
                        callData: {
                            callId: callIdToReject,
                            callType,
                            duration: 0,
                            status: "rejected",
                        },
                    });
                }, 100);
            }

            return {
                ...prev,
                incomingCall: null,
                outgoingCallId: null,
                inCall: false,
                callId: null,
                error: null,
                remoteStream: null,
                localStream: null,
            };
        });
    }, [socket]);

    useEffect(() => {
        if (!callState.inCall || callState.remoteStream) {
            return;
        }

        if (peerReadyRef.current && peerRef.current && pendingSignalsRef.current.length > 0) {
            processPendingSignals();
        }

        const timeoutId = setTimeout(() => {
            if (!callState.remoteStream && callState.inCall) {
                if (signalsProcessedRef.current?.answers === 0) {} else if (signalsProcessedRef.current?.offers === 0) {} else if (signalsProcessedRef.current?.iceCandidates === 0) {} else {}

                setCallState((prev) => ({
                    ...prev,
                    error: "Connection timeout - WebRTC handshake incomplete. Please try again.",
                }));
            }
        }, 15000);

        return () => clearTimeout(timeoutId);
    }, [callState.inCall, callState.remoteStream, processPendingSignals]);

    useEffect(() => {
        if (!callState.inCall) return;

        const interval = setInterval(() => {
            const diagnostics = {
                callId: callState.callId,
                isInitiator: callState.callId && callIdRef.current === callState.callId,
                signalsProcessed: signalsProcessedRef.current,
                pendingSignals: pendingSignalsRef.current.length,
                peerReady: peerReadyRef.current,
                hasPeer: !!peerRef.current,
                hasRemoteStream: !!callState.remoteStream,
                timestamp: new Date().toLocaleTimeString(),
            };

            if (!callState.remoteStream &&
            diagnostics.signalsProcessed.answers === 0 &&
            diagnostics.signalsProcessed.offers > 0)
                {}
        }, 3000);

        return () => clearInterval(interval);
    }, [callState.inCall, callState.callId, callState.remoteStream]);

    const toggleAudio = useCallback(() => {
        if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            if (audioTracks.length > 0) {
                const newState = !callState.isMuted;
                audioTracks.forEach((track) => {
                    track.enabled = !newState;
                });
                setCallState((prev) => ({ ...prev, isMuted: newState }));
            }
        }
    }, [callState.isMuted]);

    const toggleVideo = useCallback(() => {
        if (streamRef.current) {
            const videoTracks = streamRef.current.getVideoTracks();
            if (videoTracks.length > 0) {
                const newState = !callState.isCameraOff;
                videoTracks.forEach((track) => {
                    track.enabled = !newState;
                });
                setCallState((prev) => ({ ...prev, isCameraOff: newState }));
            }
        }
    }, [callState.isCameraOff]);

    return {
        callState,
        makeCall,
        makeGroupCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo,
    };
};

export default useCall;
