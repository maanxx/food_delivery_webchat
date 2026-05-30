import React, { useMemo } from "react";
import styles from "./MicrophoneReaction.module.css";

/**
 * Component hiển thị hiệu ứng microphone phản ứng với giọng nói
 * @param {number} audioLevel - Mức âm thanh từ 0-100
 * @param {boolean} isActive - Có đang trong cuộc gọi không
 * @param {string} size - Kích thước: 'small' | 'medium' | 'large' (default: 'large')
 */
const MicrophoneReaction = ({ audioLevel = 0, isActive = true, size = "large" }) => {
    // Tạo các vòng tròn sóng dựa trên mức âm thanh
    const rings = useMemo(() => {
        const numRings = 4;
        return Array.from({ length: numRings }, (_, i) => ({
            id: i,
            // Mỗi vòng có delay khác nhau
            delay: i * 0.1,
            // Opacity giảm dần theo vòng
            opacity: Math.max(0, 1 - i * 0.25),
        }));
    }, []);

    // Tính toán scale dựa trên audio level
    const getScale = (ringIndex) => {
        const baseScale = 1 + (audioLevel / 100) * 0.3;
        const ringDelay = ringIndex * 0.05;
        return baseScale + ringDelay;
    };

    if (!isActive) {
        return null;
    }

    const containerClass = `${styles.microphoneReactionContainer} ${styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || ""}`;

    return (
        <div className={containerClass}>
            {/* Các vòng tròn phản ứng */}
            {rings.map((ring) => (
                <div
                    key={ring.id}
                    className={styles.ring}
                    style={{
                        transform: `scale(${getScale(ring.id)})`,
                        opacity: ring.opacity * (audioLevel / 100),
                        animationDelay: `${ring.delay}s`,
                    }}
                />
            ))}

            {/* Vòng tròn chính với mic icon */}
            <div className={styles.center}>
                <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
            </div>

            {/* Hiển thị mức âm thanh dạng thanh */}
            <div className={styles.levelBar}>
                <div className={styles.levelFill} style={{ width: `${audioLevel}%` }} />
            </div>
        </div>
    );
};

export default MicrophoneReaction;
