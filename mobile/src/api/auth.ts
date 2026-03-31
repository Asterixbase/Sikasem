import { api, setTokens, clearTokens, STORAGE } from './client';
import * as SecureStore from 'expo-secure-store';

export interface OtpSendRequest { phone: string }
export interface OtpVerifyRequest { phone: string; code: string }
export interface AuthTokens { jwt: string; expires_at: string }

export const authApi = {
  sendOtp: (body: OtpSendRequest) =>
    api.post<{ sent: boolean }>('/auth/otp/send', body),

  verifyOtp: async (body: OtpVerifyRequest) => {
    const res = await api.post<AuthTokens>('/auth/otp/verify', body);
    // Store JWT securely — no refresh token in v1.3 OTP flow
    await SecureStore.setItemAsync(STORAGE.ACCESS_TOKEN, res.data.jwt);
    return res.data;
  },

  logout: async () => {
    await clearTokens();
  },
};
