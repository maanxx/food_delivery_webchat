import axiosInstance from "@config/axiosInstance";

const favoriteService = {
    getFavorites: async () => {
        const response = await axiosInstance.get("/api/user/favorites");
        return response.data;
    },

    addFavorite: async (dishId) => {
        const response = await axiosInstance.post("/api/user/favorites", {
            dish_id: dishId,
        });
        return response.data;
    },

    removeFavorite: async (dishId) => {
        const response = await axiosInstance.delete(`/api/user/favorites/${dishId}`);
        return response.data;
    },

    getFavoriteStatus: async (dishId) => {
        const response = await axiosInstance.get(`/api/user/favorites/${dishId}/status`);
        return response.data;
    },
};

export default favoriteService;
