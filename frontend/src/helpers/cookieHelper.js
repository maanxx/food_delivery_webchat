import { jwtDecode } from "jwt-decode";

const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
        return parts.pop().split(";").shift();
    }
    return null;
};

const getUserInfo = () => {
    const token = getCookie("token");

    if (token) {
        const user = jwtDecode(token);
        return user;
    } else {
        console.warn("⚠️ No token found in cookie");
        return null;
    }
};

export { getCookie, getUserInfo };
