// Globs are anchored to this file (forward slashes, which the glob engine requires on Windows)
// so Tailwind finds the sources no matter which directory Expo is started from.
const root = __dirname.split("\\").join("/");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    `${root}/App.{js,jsx,ts,tsx}`,
    `${root}/src/**/*.{js,jsx,ts,tsx}`,
    `${root}/app/**/*.{js,jsx,ts,tsx}`,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
