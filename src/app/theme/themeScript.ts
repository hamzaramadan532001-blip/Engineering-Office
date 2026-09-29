/**
 * No `"use client"` here on purpose — `layout.tsx` (a server component) needs to
 * call this directly to build the inline bootstrap `<script>`. `ThemeContext.tsx`
 * is a client module (it uses hooks), so a function it exports can't be called
 * from server code — hence this tiny standalone file.
 */
export const THEME_STORAGE_KEY = "makkah-gis-theme";

export function themeBootstrapScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var el=document.documentElement;el.setAttribute('data-theme',t);el.setAttribute('data-mantine-color-scheme',t);el.classList.toggle('calcite-mode-dark',t==='dark');}catch(e){}})();`;
}
