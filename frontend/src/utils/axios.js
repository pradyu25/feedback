import axios from 'axios';

const apiURL = import.meta.env.VITE_API_URL;

const api = axios.create({
    baseURL: apiURL || '/api',
});

if (!apiURL) {
    console.warn('VITE_API_URL is not set. Defaulting to relative /api path.');
} else {
    console.log('API Base URL:', apiURL);
}

api.interceptors.request.use((config) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
