import * as SecureStore from "expo-secure-store";


const TOKEN_KEY = 'auth_token';
const SIGNOUT_BLOCKED_KEY = 'auth_signout_blocked';

export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export const deleteTokenWithRetry = async (retries = 3): Promise<boolean> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await deleteToken();
    } catch {
      // Individual failure is ignored; removal is verified below.
    }

    try {
      if ((await getToken()) === null) {
        return true;
      }
    } catch {
      // Treat an unverified deletion as a failed deletion.
    }
  }

  return false;
};

export const setSignoutBlocked = (blocked: boolean) =>
  blocked
    ? SecureStore.setItemAsync(SIGNOUT_BLOCKED_KEY, 'true')
    : SecureStore.deleteItemAsync(SIGNOUT_BLOCKED_KEY);

export const isSignoutBlocked = async () =>
  (await SecureStore.getItemAsync(SIGNOUT_BLOCKED_KEY)) === 'true';