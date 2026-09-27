export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before first paint (see app/layout.tsx), so the page never
// flashes the wrong theme. Resolves the saved preference ("system" if unset)
// to data-theme="light" | "dark" on <html>, and keeps following the OS
// setting while the preference is "system".
export const THEME_INIT_SCRIPT = `(function(){
  var key = ${JSON.stringify(THEME_STORAGE_KEY)};
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var pref = null;
    try { pref = localStorage.getItem(key); } catch (e) {}
    var dark = pref === "dark" || (pref !== "light" && media.matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("themechange", apply);
})()`;
