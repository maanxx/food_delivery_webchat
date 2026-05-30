import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import addressService from "../../services/addressService";
import { message } from "antd";

// ─── Thunks ───────────────────────────────────────────────

export const fetchAddresses = createAsyncThunk(
    "address/fetchAddresses",
    async (_, { rejectWithValue }) => {
        try {
            const res = await addressService.getAddresses();
            return res.data?.data || [];
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch addresses");
        }
    }
);

export const addAddress = createAsyncThunk(
    "address/addAddress",
    async (data, { rejectWithValue, dispatch }) => {
        try {
            const res = await addressService.createAddress(data);
            message.success("Address added successfully");
            await dispatch(fetchAddresses());
            return res.data.data;
        } catch (error) {
            message.error("Failed to add address");
            return rejectWithValue(error.response?.data?.message || "Failed to add address");
        }
    }
);

export const updateAddress = createAsyncThunk(
    "address/updateAddress",
    async ({ id, data }, { rejectWithValue, dispatch }) => {
        try {
            const res = await addressService.updateAddress(id, data);
            message.success("Cập nhật địa chỉ thành công!");
            await dispatch(fetchAddresses());
            return res.data.data;
        } catch (error) {
            message.error("Lỗi khi cập nhật địa chỉ!");
            return rejectWithValue(error.response?.data?.message || "Failed to update address");
        }
    }
);

export const deleteAddress = createAsyncThunk(
    "address/deleteAddress",
    async (id, { rejectWithValue, dispatch }) => {
        try {
            await addressService.deleteAddress(id);
            message.success("Đã xóa địa chỉ!");
            await dispatch(fetchAddresses());
            return id;
        } catch (error) {
            message.error("Không thể xóa địa chỉ!");
            return rejectWithValue({ id, error: error.response?.data?.message });
        }
    }
);

export const setDefaultAddress = createAsyncThunk(
    "address/setDefaultAddress",
    async (id, { rejectWithValue, dispatch }) => {
        try {
            await addressService.setDefaultAddress(id);
            message.success("Đã đặt làm địa chỉ mặc định!");
            await dispatch(fetchAddresses());
            return id;
        } catch (error) {
            message.error("Lỗi khi thay đổi địa chỉ mặc định!");
            return rejectWithValue(error.response?.data?.message);
        }
    }
);

// ─── Normalize ────────────────────────────────────────────

function normalize(payload) {
    return (payload || []).map(addr => ({
        ...addr,
        isDefault: !!(addr.isDefault ?? addr.is_default ?? false),
    }));
}

// ─── Slice ────────────────────────────────────────────────

const addressSlice = createSlice({
    name: "address",
    initialState: {
        addresses: [],
        loading: false,
        error: null,
        loadingMap: {},
    },
    reducers: {
        clearError: (state) => { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            // ── Fetch ──
            .addCase(fetchAddresses.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAddresses.fulfilled, (state, action) => {
                state.loading = false;
                state.addresses = normalize(action.payload);
                console.log("REDUX ADDRESSES:", state.addresses.map(a => ({ id: a.addressId, isDefault: a.isDefault })));
            })
            .addCase(fetchAddresses.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // ── Add ──
            .addCase(addAddress.fulfilled, () => {})

            // ── Delete ──
            .addCase(deleteAddress.pending, (state, action) => {
                state.loadingMap[action.meta.arg] = { ...state.loadingMap[action.meta.arg], deleting: true };
            })
            .addCase(deleteAddress.fulfilled, (state, action) => {
                delete state.loadingMap[action.meta.arg];
            })
            .addCase(deleteAddress.rejected, (state, action) => {
                delete state.loadingMap[action.meta.arg];
            })

            // ── Set Default (OPTIMISTIC + BACKEND SYNC) ──
            .addCase(setDefaultAddress.pending, (state, action) => {
                const selectedId = action.meta.arg;
                state.loadingMap[selectedId] = { ...state.loadingMap[selectedId], settingDefault: true };
                // INSTANT UI UPDATE
                state.addresses = state.addresses.map(addr => ({
                    ...addr,
                    isDefault: addr.addressId === selectedId,
                }));
            })
            .addCase(setDefaultAddress.fulfilled, (state, action) => {
                delete state.loadingMap[action.meta.arg];
                // fetchAddresses in thunk already replaced state.addresses
            })
            .addCase(setDefaultAddress.rejected, (state, action) => {
                delete state.loadingMap[action.meta.arg];
                // fetchAddresses in thunk handles recovery
            });
    },
});

export const { clearError } = addressSlice.actions;
export default addressSlice.reducer;
