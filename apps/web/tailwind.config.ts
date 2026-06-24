import type { Config } from "tailwindcss";
import { brand } from "@drip-tv/shared";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sapphire: brand.colors.sapphire,
        maroon: brand.colors.maroon,
        aqua: brand.colors.aqua,
        paua: brand.colors.paua,
        royal: brand.colors.royal,
        cornflower: brand.colors.cornflower,
        athens: brand.colors.athens,
        ink: brand.colors.ink,
      },
      fontFamily: {
        sans: brand.fonts.body.split(",").map((s) => s.trim().replace(/"/g, "")),
        heading: brand.fonts.heading.split(",").map((s) => s.trim().replace(/"/g, "")),
        display: brand.fonts.display.split(",").map((s) => s.trim().replace(/"/g, "")),
      },
      fontSize: {
        h1: [`${brand.type.h1.size}px`, { lineHeight: `${brand.type.h1.line}px`, letterSpacing: `${brand.type.h1.letter}px` }],
        h2: [`${brand.type.h2.size}px`, { lineHeight: `${brand.type.h2.line}px`, letterSpacing: `${brand.type.h2.letter}px` }],
        h3: [`${brand.type.h3.size}px`, { lineHeight: `${brand.type.h3.line}px` }],
        h4: [`${brand.type.h4.size}px`, { lineHeight: `${brand.type.h4.line}px` }],
        h5: [`${brand.type.h5.size}px`, { lineHeight: `${brand.type.h5.line}px`, letterSpacing: `${brand.type.h5.letter}px` }],
        btn: [`${brand.type.button.size}px`, { lineHeight: `${brand.type.button.line}px`, letterSpacing: `${brand.type.button.letter}px` }],
        body: [`${brand.type.body.size}px`, { lineHeight: `${brand.type.body.line}px` }],
      },
    },
  },
  plugins: [],
};
export default config;
