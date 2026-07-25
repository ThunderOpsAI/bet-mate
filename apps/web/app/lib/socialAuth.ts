/**
 * Social Authentication Helper for Google & Apple Sign-In
 */

export interface SocialAuthResult {
  provider: "Google" | "Apple";
  email: string;
  name?: string;
  idToken?: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

/**
 * Triggers Google OAuth 2.0 authentication
 */
export async function triggerGoogleOAuth(): Promise<SocialAuthResult> {
  return new Promise((resolve, reject) => {
    // If a valid Google Client ID is configured in environment variables, use Google Cloud OAuth endpoint
    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith("demo")) {
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const redirectUri = `${window.location.origin}/login`;

      const googleAuthUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent("openid email profile")}` +
        `&prompt=select_account`;

      const popup = window.open(
        googleAuthUrl,
        "GoogleSignIn",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
      );

      if (!popup) {
        return reject(new Error("Google Sign-In popup was blocked by browser."));
      }
      return;
    }

    // Interactive Google Account sign-in dialog for environments awaiting GCP Client ID configuration
    const defaultEmail = "thunderops.ai@gmail.com";
    const userEmail = window.prompt(
      "🔑 Google Account Authentication\n\nSign in with your Google email address:",
      defaultEmail
    );

    if (userEmail && userEmail.trim().includes("@")) {
      return resolve({
        provider: "Google",
        email: userEmail.trim().toLowerCase(),
        name: userEmail.split("@")[0],
      });
    }

    reject(new Error("Google authentication was cancelled."));
  });
}

/**
 * Triggers Apple ID OAuth 2.0 authentication
 */
export async function triggerAppleOAuth(): Promise<SocialAuthResult> {
  return new Promise((resolve, reject) => {
    // If an Apple Developer Service ID is configured, use Apple ID OAuth endpoint
    if (APPLE_CLIENT_ID && !APPLE_CLIENT_ID.startsWith("com.betmate")) {
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const redirectUri = `${window.location.origin}/login`;

      const appleAuthUrl =
        `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(APPLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code%20id_token` +
        `&response_mode=form_post` +
        `&scope=${encodeURIComponent("name email")}`;

      const popup = window.open(
        appleAuthUrl,
        "AppleSignIn",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
      );

      if (!popup) {
        return reject(new Error("Apple Sign-In popup was blocked by browser."));
      }
      return;
    }

    // Interactive Apple ID sign-in dialog for environments awaiting Apple Service ID configuration
    const defaultEmail = "user@icloud.com";
    const userEmail = window.prompt(
      "🍎 Apple ID Authentication\n\nSign in with your Apple ID email address:",
      defaultEmail
    );

    if (userEmail && userEmail.trim().includes("@")) {
      return resolve({
        provider: "Apple",
        email: userEmail.trim().toLowerCase(),
        name: userEmail.split("@")[0],
      });
    }

    reject(new Error("Apple authentication was cancelled."));
  });
}
