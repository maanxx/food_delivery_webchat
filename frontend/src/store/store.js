import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
const storage = {
    getItem: (key) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key, value) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
    },
    removeItem: (key) => {
        localStorage.removeItem(key);
        return Promise.resolve();
    },
};

import authReducer from "@features/auth/authSlice";
import chatReducer from "@features/chat/chatSlice";
import userReducer from "@features/user/userSlice";

const persistConfig = {
    key: "root",
    storage,
    blacklist: [], 
};

const rootReducer = combineReducers({
    auth: authReducer,
    chat: chatReducer,
    user: userReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);
const store = configureStore({
    reducer: persistedReducer,
    devTools: process.env.NODE_ENV !== "production",
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
            },
        }),
});

const persistor = persistStore(store);

export { store, persistor };

