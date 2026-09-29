/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#f8f5f9",
					100: "#e8dfeb",
					200: "#d0bfd6",
					300: "#b99fc2",
					400: "#a17fad",
					500: "#8a5f99",
					600: "#714c80",
					700: "#5a3c66",
					800: "#432d4d",
					900: "#2d1e33",
					950: "#190f1d",
				},
			},
			boxShadow: {
				"soft-sm": "0 1px 2px rgba(25, 15, 29, 0.06), 0 1px 1px rgba(25, 15, 29, 0.04)",
				"soft-md": "0 4px 12px rgba(25, 15, 29, 0.08), 0 2px 4px rgba(25, 15, 29, 0.05)",
				"soft-lg": "0 12px 28px rgba(25, 15, 29, 0.12), 0 4px 10px rgba(25, 15, 29, 0.06)",
				"brand-glow": "0 0 0 1px rgba(138, 95, 153, 0.16), 0 8px 24px rgba(138, 95, 153, 0.28)",
			},
			borderRadius: {
				xl: "1rem",
				"2xl": "1.5rem",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
