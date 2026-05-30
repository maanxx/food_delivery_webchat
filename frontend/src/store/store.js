import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

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

