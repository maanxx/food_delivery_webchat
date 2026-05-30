import axios from "axios";

const getAccessToken = () => sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
const getRefreshToken = () => sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
const clearTokens = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
};

const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_SERVER_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

axiosInstance.interceptors.request.use((config) => {
    const token = getAccessToken();

    config.headers = config.headers || {};

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    console.log("REQUEST HEADERS:", config.headers);

    return config;
}, (error) => {
    return Promise.reject(error);
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            
            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return axiosInstance(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;
            const refreshToken = getRefreshToken();

            if (!refreshToken) {
                clearTokens();
                if (window.location.pathname !== "/login") window.location.href = "/login";
                return Promise.reject(error);
            }


            try {
                const { data } = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/auth/refresh`, {
                    refreshToken
                });

                if (data.success) {
                    const newAccessToken = data.accessToken;
                    
                    const storage = localStorage.getItem("refresh_token") ? localStorage : sessionStorage;
                    storage.setItem("access_token", newAccessToken);
                    
                    processQueue(null, newAccessToken);

                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axiosInstance(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearTokens();
                if (window.location.pathname !== "/login") window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
