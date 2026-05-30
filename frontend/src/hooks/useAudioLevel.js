import { useEffect, useRef, useState } from "react";

/**
 * Hook để phát hiện mức âm thanh từ một audio stream
 * @param {MediaStream} stream - Audio stream để phân tích
 * @param {number} updateInterval - Thời gian cập nhật level (ms)
 * @returns {number} Mức âm thanh từ 0-100
 */
export function useAudioLevel(stream, updateInterval = 50) {
    const [audioLevel, setAudioLevel] = useState(0);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);

    useEffect(() => {
        if (!stream) {
            setAudioLevel(0);
            return;
        }

        try {
            // Tạo AudioContext
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;

            // Tạo analyser node
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;

            // Kết nối stream đến analyser
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let lastUpdateTime = Date.now();

            const updateLevel = () => {
                animationRef.current = requestAnimationFrame(updateLevel);

                const now = Date.now();
                if (now - lastUpdateTime >= updateInterval) {
                    analyser.getByteFrequencyData(dataArray);

                    // Tính toán mức âm thanh trung bình
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;

                    // Chuẩn hóa thành 0-100
                    // Dùng logarithmic scale để hiệu ứng tự nhiên hơn
                    const level = Math.min(100, Math.max(0, (average / 255) * 150));

                    setAudioLevel(level);
                    lastUpdateTime = now;
                }
            };

            updateLevel();

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close().catch(() => {});
                }
            };
        } catch (error) {
            console.error("Failed to set up audio level detection:", error);
            setAudioLevel(0);
        }
    }, [stream, updateInterval]);

    return audioLevel;
}

export default useAudioLevel;
