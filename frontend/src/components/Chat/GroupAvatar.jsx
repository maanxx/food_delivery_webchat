import React from "react";
import { Avatar } from "antd";
import { getFirstLetterOfEachWord } from "@helpers/stringHelper";

const GroupAvatar = ({ members = [], size = 40 }) => {
    if (!members || members.length === 0) {
        return (
            <Avatar
                size={size}
                style={{
                    backgroundColor: "#1890ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: `${size / 2.8}px`,
                }}
            >
                G
            </Avatar>
        );
    }

    // Only show up to 3 avatars
    const displayMembers = members.slice(0, 3);
    const count = displayMembers.length;

    // Calculate sizes and positions based on the number of avatars
    const getAvatarStyles = (index) => {
        const baseSize = size * 0.7; // Smaller avatars for overlapping
        
        if (count === 1) {
            return {
                width: size,
                height: size,
                zIndex: 1,
            };
        }

        if (count === 2) {
            return {
                width: baseSize,
                height: baseSize,
                position: "absolute",
                border: "2px solid white",
                bottom: index === 0 ? "0" : "auto",
                top: index === 1 ? "0" : "auto",
                left: index === 0 ? "0" : "auto",
                right: index === 1 ? "0" : "auto",
                zIndex: index === 1 ? 2 : 1,
            };
        }

        // 3 avatars
        if (index === 0) { // Bottom left
            return {
                width: baseSize,
                height: baseSize,
                position: "absolute",
                bottom: "0",
                left: "0",
                border: "2px solid white",
                zIndex: 1,
            };
        }
        if (index === 1) { // Bottom right
            return {
                width: baseSize,
                height: baseSize,
                position: "absolute",
                bottom: "0",
                right: "0",
                border: "2px solid white",
                zIndex: 2,
            };
        }
        // Top center
        return {
            width: baseSize,
            height: baseSize,
            position: "absolute",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
            border: "2px solid white",
            zIndex: 3,
        };
    };

    return (
        <div 
            style={{ 
                width: size, 
                height: size, 
                position: "relative",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            {displayMembers.map((member, index) => (
                <Avatar
                    key={member.userId || index}
                    size="small"
                    src={member.avatarPath}
                    style={{
                        ...getAvatarStyles(index),
                        backgroundColor: "#1890ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: `${size / 3.5}px`,
                        fontWeight: "600",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                >
                    {!member.avatarPath && member.fullname
                        ? getFirstLetterOfEachWord(member.fullname).children
                        : "U"}
                </Avatar>
            ))}
        </div>
    );
};

export default GroupAvatar;
