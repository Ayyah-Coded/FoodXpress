import axios from 'axios';
import { getToken } from './auth';


export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = getToken();

  if (token) config.headers.Authorization = `Bearer ${token}`

  return config;
});