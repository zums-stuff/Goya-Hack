// components/auth/pollar-svgs.ts — Inline SVG strings for brand icons we
// render inside PollarLoginActions. Inlined so we don't take on a runtime
// icon-lib dependency just for these glyphs, and so they match the
// colors used on the pollar.xyz interactive-demo (those exact brand colors
// are the visual contract on this surface).
//
// Each export is the inner markup of an SVG. Render inside a 16-22px
// sized <svg> via dangerouslySetInnerHTML, or move to JSX if size grows.

// NOTE: there is deliberately no `gre_pollar_mark` here anymore. The one
// that used to live in this file was a hand-drawn shield path, not
// Pollar's logo, and it shipped as the auth-card mark. The real mark is
// the official asset at public/brand/mark-blue.png (474x512, from
// https://pollar.xyz/brand/, referenced in pollar.xyz's own HTML),
// rendered as an <img class="pollar-login-mark"> in
// components/auth/PollarLoginActions.tsx. Don't re-add an inline
// stand-in -- pull the asset from Pollar's brand directory instead.


export const gre_google = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>`;

export const gre_discord = `
<svg viewBox="0 -28.5 256 256" xmlns="http://www.w3.org/2000/svg" fill="#5865F2">
  <path d="M216.856 16.597A208.502 208.502 0 0 0 164.978 0c-1.927 4.054-4.335 9.418-5.954 13.692-19.378-2.929-38.683-2.929-58.061 0-1.62-4.274-4.061-9.638-5.988-13.692a209.046 209.046 0 0 0-51.882 16.587C5.384 96.687 0 175.94 16.804 252.668a211.49 211.49 0 0 0 64.196 32.474c5.18-7.105 9.795-14.66 13.78-22.658-7.535-2.85-14.717-6.628-21.493-11.318 1.806-1.32 3.564-2.715 5.255-4.156 41.182 19.162 87.394 19.162 128.576 0 1.706 1.44 3.464 2.835 5.27 4.156-6.804 4.69-14.001 8.468-21.536 11.318a222.53 222.53 0 0 0 13.768-22.658c16.804-76.728 11.418-156.022-15.877-236.07zM86.034 171.927c-10.118 0-18.41-9.298-18.41-20.713s8.16-20.713 18.41-20.713c10.337 0 18.524 9.298 18.41 20.713.114 11.415-8.073 20.713-18.41 20.713zm85.354 0c-10.118 0-18.41-9.298-18.41-20.713s8.16-20.713 18.41-20.713c10.337 0 18.524 9.298 18.41 20.713.114 11.415-8.073 20.713-18.41 20.713z"/>
</svg>`;

export const gre_twitter = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
</svg>`;

export const gre_github = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
</svg>`;

export const gre_apple = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
</svg>`;
