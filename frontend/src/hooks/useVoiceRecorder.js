import { useState, useRef, useCallback } from "react";

const useVoiceRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const timerRef = useRef(null);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setRecordingTime(0);
            setRecordedBlob(null);
            chunksRef.current = [];

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Create MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
                audioBitsPerSecond: 128000,
            });

            mediaRecorderRef.current = mediaRecorder;

            // Handle data available
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            // Handle recording stop
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setRecordedBlob(blob);
                clearInterval(timerRef.current);
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to start recording:", err);
            setError(err.message || "Failed to access microphone");
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop all tracks - safe check for native MediaStream API
            if (streamRef.current) {
                try {
                    if (typeof streamRef.current.getTracks === "function") {
                        streamRef.current.getTracks().forEach((track) => {
                            try {
                                track.stop();
                            } catch (e) {
                                console.warn("Error stopping track:", e);
                            }
                        });
                    }
                } catch (e) {
                    console.warn("Error accessing tracks:", e);
                }
            }

            clearInterval(timerRef.current);
        }
    }, [isRecording]);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordedBlob(null);
            setRecordingTime(0);

            // Stop all tracks - safe check for native MediaStream API
            if (streamRef.current) {
                try {
                    if (typeof streamRef.current.getTracks === "function") {
                        streamRef.current.getTracks().forEach((track) => {
                            try {
                                track.stop();
                            } catch (e) {
                                console.warn("Error stopping track:", e);
                            }
                        });
                    }
                } catch (e) {
                    console.warn("Error accessing tracks:", e);
                }
            }

            clearInterval(timerRef.current);
            chunksRef.current = [];
        }
    }, [isRecording]);

    const clearRecording = useCallback(() => {
        setRecordedBlob(null);
        setRecordingTime(0);
        chunksRef.current = [];
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return {
        isRecording,
        recordingTime,
        recordedBlob,
        error,
        startRecording,
        stopRecording,
        cancelRecording,
        clearRecording,
        formatTime,
    };
};

export default useVoiceRecorder;
