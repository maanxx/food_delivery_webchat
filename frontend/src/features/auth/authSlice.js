import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import profileService from "@services/profileService";
import { fetchAddresses } from "@features/address/addressSlice";

export const initializeAuth = createAsyncThunk(
    "auth/initialize",
    async (_, { dispatch, rejectWithValue }) => {
        const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
        if (!token) {
            return rejectWithValue("No token found");
        }

        try {
            const response = await profileService.getProfile();
            if (response.data && response.data.success) {
                // Ensure fresh addresses are loaded after successful auth sync
                dispatch(fetchAddresses());
                // Return payload in a structure the reducer expects
                return { user: response.data.data, token };
            }
            return rejectWithValue("Session invalid");
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                sessionStorage.removeItem("access_token");
                sessionStorage.removeItem("refresh_token");
            }
            return rejectWithValue(error.response?.data?.message || "Initialization failed");
        }
    }
);

const initialState = {
    isAuthenticated: false,
    user: null,
    isInitialized: false, // Prevents premature redirect
    isLoading: false,
    error: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        login: (state, action) => {
            if (!action.payload) return;

            state.isAuthenticated = true;
            // SAFE ACCESS: Support both { accessToken, user } and direct user object
            state.user = action.payload?.user || action.payload || null;
            state.isInitialized = true;

            const tokenSource = action.payload?.token || action.payload?.accessToken;
            const refreshSource = action.payload?.refreshToken;
            const rememberMe = action.payload?.rememberMe;

            const storage = rememberMe ? localStorage : sessionStorage;

            if (tokenSource) {
                storage.setItem("access_token", tokenSource);
            }
            if (refreshSource) {
                storage.setItem("refresh_token", refreshSource);
            }

            if (rememberMe) {
                sessionStorage.removeItem("access_token");
                sessionStorage.removeItem("refresh_token");
            }
        },
        logout: (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.isInitialized = true;
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("refresh_token");
        },
        setInitialized: (state) => {
            state.isInitialized = true;
        },
        updateUser: (state, action) => {
            if (state.user && action.payload) {
                state.user = { ...state.user, ...action.payload };
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(initializeAuth.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(initializeAuth.fulfilled, (state, action) => {
                state.isAuthenticated = true;
                state.user = action.payload?.user || null;
                state.isInitialized = true;
                state.isLoading = false;
            })
            .addCase(initializeAuth.rejected, (state) => {
                state.isAuthenticated = false;
                state.user = null;
                state.isInitialized = true;
                state.isLoading = false;
            });
    },
});

export const { login, logout, setInitialized, updateUser } = authSlice.actions;
export default authSlice.reducer;
