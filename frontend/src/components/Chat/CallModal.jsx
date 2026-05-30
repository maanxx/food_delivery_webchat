import React from "react";
import { Modal, Space, Button, Spin, Alert } from "antd";
import { PhoneOutlined, VideoCameraOutlined, CloseOutlined } from "@ant-design/icons";
import styles from "./CallModal.module.css";

const CallModal = ({ visible, loading, error, onVoiceCall, onVideoCall, onCancel }) => {
    return (
        <Modal
            title="Initiate Call"
            open={visible}
            onCancel={onCancel}
            footer={null}
            centered
            className={styles.callModal}
        >
            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />}

            <Spin spinning={loading}>
                <div className={styles.modalContent}>
                    <p style={{ marginBottom: "24px", textAlign: "center" }}>
                        Choose the type of call you want to initiate:
                    </p>

                    <Space direction="vertical" style={{ width: "100%" }} size="large">
                        <Button
                            type="primary"
                            size="large"
                            icon={<PhoneOutlined />}
                            onClick={onVoiceCall}
                            loading={loading}
                            block
                            className={styles.voiceButton}
                        >
                            Voice Call
                        </Button>

                        <Button
                            type="primary"
                            size="large"
                            icon={<VideoCameraOutlined />}
                            onClick={onVideoCall}
                            loading={loading}
                            block
                            className={styles.videoButton}
                            style={{ background: "#13c2c2", borderColor: "#13c2c2" }}
                        >
                            Video Call
                        </Button>

                        <Button
                            danger
                            size="large"
                            icon={<CloseOutlined />}
                            onClick={onCancel}
                            disabled={loading}
                            block
                        >
                            Cancel
                        </Button>
                    </Space>
                </div>
            </Spin>
        </Modal>
    );
};

export default CallModal;
