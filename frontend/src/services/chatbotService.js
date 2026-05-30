/**
 * ============================================================
 *  CHATBOT SERVICE — chatbotService.js  (Frontend / React)
 * ============================================================
 *
 *  Gọi API POST /api/chat kèm tin nhắn và lịch sử hội thoại.
 *
 *  ⚠️  Lưu ý về format lịch sử:
 *   Frontend lưu trữ theo format OpenAI-style:
 *     { role: "user" | "assistant", content: "..." }
 *   Backend (chatbotController) sẽ tự convert sang Gemini format.
 *   Frontend KHÔNG cần biết về Gemini — gửi đúng format này là đủ.
 * ============================================================
 */

import axiosInstance from "@config/axiosInstance";

/**
 * Gửi tin nhắn đến AI Chatbot thông qua Backend RAG + Gemini Pipeline.
 *
 * @param {string} message
 *   Tin nhắn mới nhất của user (CHƯA được thêm vào chatHistory).
 *   Backend sẽ tự append vào cuối sau Sliding Window.
 *
 * @param {Array<{role: "user"|"assistant", content: string}>} chatHistory
 *   Toàn bộ lịch sử hội thoại đang lưu trên Frontend.
 *   Backend tự áp dụng Sliding Window (giữ 5 tin cuối) và
 *   convert sang Gemini format (role "model", parts[]).
 *
 * @returns {Promise<{reply: string, cards: Array}>} - Nội dung text và danh sách card món ăn fallback
 * @throws {Error} - Nếu API thất bại, ném lỗi có message thân thiện
 *
 * @example
 *   // Trong component React:
 *   const [chatHistory, setChatHistory] = useState([]);
 *
 *   const handleSend = async (userText) => {
 *     try {
 *       const reply = await sendChatMessage(userText, chatHistory);
 *       setChatHistory(prev => [
 *         ...prev,
 *         { role: "user", content: userText },
 *         { role: "assistant", content: reply }
 *       ]);
 *     } catch (err) {
 *       console.error(err.message);
 *     }
 *   };
 */
const sendChatMessage = async (message, chatHistory = [], options = {}) => {
    try {
        // ── Validate client-side ──────────────────────────────
        if (!message || message.trim() === "") {
            throw new Error("Tin nhắn không được để trống.");
        }

        // ── Gửi request lên Backend ───────────────────────────
        const response = await axiosInstance({
            url: "/api/chat",
            method: "post",
            data: {
                // Tin nhắn mới nhất
                message: message.trim(),
                sessionId: options.sessionId || "",

                // Lịch sử chat — giữ nguyên format OpenAI-style,
                // backend tự xử lý convert và sliding window
                chatHistory: chatHistory.map(({ role, content, dishes = [] }) => ({
                    role,    // "user" hoặc "assistant"
                    content, // chuỗi văn bản
                    dishes,
                })),
            },
        });

        // ── Kiểm tra response ─────────────────────────────────
        if (response.data?.success && response.data?.data?.reply) {
            return {
                reply: response.data.data.reply,
                cards: Array.isArray(response.data.data.cards) ? response.data.data.cards : [],
            };
        }

        throw new Error(
            response.data?.message || "Phản hồi từ server không hợp lệ."
        );
    } catch (error) {
        // ── Phân loại lỗi để hiển thị đúng thông báo ─────────
        if (error.response) {
            // Lỗi HTTP (4xx, 5xx) có response body
            const status = error.response.status;
            const serverMsg = error.response.data?.message;

            if (status === 503) {
                throw new Error(
                    serverMsg || "Hệ thống AI đang bận. Vui lòng thử lại sau ít giây."
                );
            }
            if (status === 400) {
                throw new Error(serverMsg || "Dữ liệu gửi lên không hợp lệ.");
            }
            throw new Error(
                serverMsg || `Lỗi máy chủ (${status}). Vui lòng thử lại.`
            );
        }

        if (error.request) {
            // Request đã gửi nhưng không nhận được response (timeout, mất mạng)
            throw new Error(
                "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."
            );
        }

        // Lỗi logic / validation phía client
        throw new Error(error.message || "Đã xảy ra lỗi không xác định.");
    }
};

export { sendChatMessage };
