/**
 * Minimal ambient typing for the Google Identity Services script (loaded via a plain <script>
 * tag in index.html, not an npm package — no @types/google.accounts exists for it). Only covers
 * the handful of calls GoogleSignInButtonComponent actually makes.
 */

export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(
            parent: HTMLElement,
            options: { theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; width?: number }
          ): void;
          cancel(): void;
        };
      };
    };
  }
}
