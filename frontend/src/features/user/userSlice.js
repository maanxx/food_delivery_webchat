import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import profileService from "../../services/profileService";
import favoriteService from "@services/favoriteService";
import { logout, updateUser } from "../auth/authSlice";
import { message } from "antd";

export const updateUserProfile = createAsyncThunk(
    "user/updateProfile",
    async (formData, { rejectWithValue, dispatch }) => {
        try {
            const response = await profileService.updateProfile(formData);
            const freshUser = response.data.data;
            
            // Sync with global auth state (Header, Sidebar, etc)
            dispatch(updateUser(freshUser));
            
            return freshUser;
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Cập nhật hồ sơ thất bại";
            message.error(errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

export const updateUserAvatar = createAsyncThunk(
    "user/updateAvatar",
    async (file, { rejectWithValue, dispatch }) => {
        try {
            const formData = new FormData();
            formData.append("avatar", file);
            const response = await profileService.updateProfile(formData);
            const freshUser = response.data.data;
            dispatch(updateUser(freshUser));
            return freshUser;
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Cập nhật ảnh đại diện thất bại";
            message.error(errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

export const fetchUserFavorites = createAsyncThunk(
    "user/fetchFavorites",
    async (_, { rejectWithValue }) => {
        try {
            const response = await favoriteService.getFavorites();
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Không thể tải món yêu thích";
            return rejectWithValue(errorMsg);
        }
    }
);

export const addUserFavorite = createAsyncThunk(
    "user/addFavorite",
    async (dishId, { rejectWithValue }) => {
        try {
            const response = await favoriteService.addFavorite(dishId);
            return {
                dishId,
                data: response.data,
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Không thể thêm món yêu thích";
            return rejectWithValue({ dishId, message: errorMsg });
        }
    }
);

export const removeUserFavorite = createAsyncThunk(
    "user/removeFavorite",
    async (dishId, { rejectWithValue }) => {
        try {
            const response = await favoriteService.removeFavorite(dishId);
            return {
                dishId,
                data: response.data,
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Không thể xóa món yêu thích";
            return rejectWithValue({ dishId, message: errorMsg });
        }
    }
);

const initialState = {
    loading: false,
    avatarLoading: false,
    favoritesLoading: false,
    favoriteActionLoading: {},
    favoriteItems: [],
    favoriteIds: [],
    favoritesLoaded: false,
    error: null,
    success: false,
};

const getSafeUserState = (state) => ({
    ...initialState,
    ...(state?.user || {}),
    favoriteActionLoading: state?.user?.favoriteActionLoading || {},
    favoriteItems: Array.isArray(state?.user?.favoriteItems)
        ? state.user.favoriteItems
        : [],
    favoriteIds: Array.isArray(state?.user?.favoriteIds)
        ? state.user.favoriteIds
        : [],
});

const ensureFavoritesState = (state) => {
    if (!state.favoriteActionLoading || typeof state.favoriteActionLoading !== "object") {
        state.favoriteActionLoading = {};
    }

    if (!Array.isArray(state.favoriteItems)) {
        state.favoriteItems = [];
    }

    if (!Array.isArray(state.favoriteIds)) {
        state.favoriteIds = [];
    }
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        resetState: (state) => {
            state.loading = false;
            state.avatarLoading = false;
            state.favoritesLoading = false;
            state.error = null;
            state.success = false;
        },
        resetFavoritesState: (state) => {
            state.favoritesLoading = false;
            state.favoriteActionLoading = {};
            state.favoriteItems = [];
            state.favoriteIds = [];
            state.favoritesLoaded = false;
        },
    },
    extraReducers: (builder) => {
        builder
            // Profile Info Update
            .addCase(updateUserProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(updateUserProfile.fulfilled, (state) => {
                state.loading = false;
                state.success = true;
                message.success("Cập nhật hồ sơ thành công!");
            })
            .addCase(updateUserProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Avatar Update
            .addCase(updateUserAvatar.pending, (state) => {
                state.avatarLoading = true;
                state.error = null;
            })
            .addCase(updateUserAvatar.fulfilled, (state) => {
                state.avatarLoading = false;
                message.success("Cập nhật ảnh đại diện thành công!");
            })
            .addCase(updateUserAvatar.rejected, (state, action) => {
                state.avatarLoading = false;
                state.error = action.payload;
            })

            // Favorites Fetch
            .addCase(fetchUserFavorites.pending, (state) => {
                ensureFavoritesState(state);
                state.favoritesLoading = true;
            })
            .addCase(fetchUserFavorites.fulfilled, (state, action) => {
                ensureFavoritesState(state);
                const items = action.payload?.items || [];
                state.favoritesLoading = false;
                state.favoriteItems = items;
                state.favoriteIds = items.map((item) => item.dish_id);
                state.favoritesLoaded = true;
            })
            .addCase(fetchUserFavorites.rejected, (state, action) => {
                ensureFavoritesState(state);
                state.favoritesLoading = false;
                state.error = action.payload;
            })

            // Add Favorite
            .addCase(addUserFavorite.pending, (state, action) => {
                ensureFavoritesState(state);
                state.favoriteActionLoading[action.meta.arg] = true;
            })
            .addCase(addUserFavorite.fulfilled, (state, action) => {
                ensureFavoritesState(state);
                const dishId = action.payload.dishId;
                const dish = action.payload.data?.dish;

                delete state.favoriteActionLoading[dishId];

                if (!state.favoriteIds.includes(dishId)) {
                    state.favoriteIds.unshift(dishId);
                }

                if (dish) {
                    state.favoriteItems = [
                        dish,
                        ...state.favoriteItems.filter((item) => item.dish_id !== dishId),
                    ];
                }

                message.success("Đã thêm vào món yêu thích");
            })
            .addCase(addUserFavorite.rejected, (state, action) => {
                ensureFavoritesState(state);
                const dishId = action.payload?.dishId || action.meta.arg;
                delete state.favoriteActionLoading[dishId];
                state.error = action.payload?.message || action.payload;
                message.error(action.payload?.message || "Không thể thêm món yêu thích");
            })

            // Remove Favorite
            .addCase(removeUserFavorite.pending, (state, action) => {
                ensureFavoritesState(state);
                state.favoriteActionLoading[action.meta.arg] = true;
            })
            .addCase(removeUserFavorite.fulfilled, (state, action) => {
                ensureFavoritesState(state);
                const dishId = action.payload.dishId;
                delete state.favoriteActionLoading[dishId];
                state.favoriteIds = state.favoriteIds.filter((id) => id !== dishId);
                state.favoriteItems = state.favoriteItems.filter(
                    (item) => item.dish_id !== dishId,
                );
                message.success("Đã xóa khỏi món yêu thích");
            })
            .addCase(removeUserFavorite.rejected, (state, action) => {
                ensureFavoritesState(state);
                const dishId = action.payload?.dishId || action.meta.arg;
                delete state.favoriteActionLoading[dishId];
                state.error = action.payload?.message || action.payload;
                message.error(action.payload?.message || "Không thể xóa món yêu thích");
            })
            .addCase(logout, (state) => {
                state.loading = false;
                state.avatarLoading = false;
                state.favoritesLoading = false;
                state.favoriteActionLoading = {};
                state.favoriteItems = [];
                state.favoriteIds = [];
                state.favoritesLoaded = false;
                state.error = null;
                state.success = false;
            });
    },
});

export const { resetState, resetFavoritesState } = userSlice.actions;
export const selectFavoriteItems = (state) => getSafeUserState(state).favoriteItems;
export const selectFavoriteIds = (state) => getSafeUserState(state).favoriteIds;
export const selectFavoritesLoaded = (state) => getSafeUserState(state).favoritesLoaded;
export const selectFavoritesLoading = (state) => getSafeUserState(state).favoritesLoading;
export const selectIsFavorite = (dishId) => (state) =>
    getSafeUserState(state).favoriteIds.includes(dishId);
export const selectFavoriteActionLoading = (dishId) => (state) =>
    Boolean(getSafeUserState(state).favoriteActionLoading[dishId]);
export default userSlice.reducer;
