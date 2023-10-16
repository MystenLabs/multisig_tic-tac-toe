/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  prefix: "tw-",
  corePlugins: {
      preflight: false
  },
  plugins: [],
}

