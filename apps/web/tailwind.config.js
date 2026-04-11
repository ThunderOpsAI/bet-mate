const brandColors = {
  ink: "#101312",
  surface: "#171b19",
  elevated: "#181d1a",
  paper: "#f6f4ee",
  muted: "#98a39a",
  eucalypt: "#12a17e",
  coral: "#e45b44",
  gold: "#f2c14e",
  aqua: "#39a6a3",
};

/** @type {{ content: string[], theme: { extend: Record<string, unknown> } }} */
const config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: brandColors,
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        brand: "8px",
        "brand-sm": "6px",
      },
    },
  },
};

module.exports = config;
