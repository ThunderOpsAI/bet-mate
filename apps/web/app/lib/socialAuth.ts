/**
 * @deprecated Social Authentication has been deprecated.
 * Email + password is now the sole authentication path for BetMate.
 */

export interface SocialAuthResult {
  provider: "Google";
  email: string;
  name?: string;
  idToken?: string;
}

/**
 * @deprecated Deprecated social OAuth trigger. Email + password is the sole auth path.
 */
export async function triggerGoogleOAuth(): Promise<SocialAuthResult> {
  throw new Error("Social authentication is deprecated. Please use email and password to sign in.");
}
