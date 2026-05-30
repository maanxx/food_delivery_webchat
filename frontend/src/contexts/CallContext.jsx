import React, { createContext, useContext } from "react";
import useCall from "@hooks/useCall";
import useWebSocket from "@hooks/useWebSocket";
import useCallNotification from "@hooks/useCallNotification";

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
    const { socket } = useWebSocket();
    const call = useCall(socket);

    // Global notification/ringtone management
    useCallNotification(call.callState.incomingCall, call.callState.outgoingCallId, call.callState.inCall);

    return (
        <CallContext.Provider value={call}>
            {children}
        </CallContext.Provider>
    );
};

export const useCallContext = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error("useCallContext must be used within a CallProvider");
    }
    return context;
};
