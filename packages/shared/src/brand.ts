/**
 * Drip TV brand tokens — derived from the Hydrate Medical brand guide.
 * Shared by web (Tailwind theme) and player (RN StyleSheet) so brand
 * decisions live in one place.
 */
export const brand = {
  name: "Drip TV",
  tagline: "Retail displays, remote-controlled.",
  colors: {
    sapphire: "#364ca0",
    maroon: "#dc1b51",
    aqua: "#4cc3c7",
    paua: "#2a264d",
    royal: "#425cdb",
    cornflower: "#2ea3f2",
    athens: "#eaeff4",
    ink: "#0b0d12",
    white: "#ffffff",
  },
  fonts: {
    body: '"Avenir Next", Avenir, Lato, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    heading: '"Pathway Gothic One", "Avenir Next Condensed", Impact, sans-serif',
    display: '"Baron Neue", "Pathway Gothic One", Impact, sans-serif',
  },
  type: {
    h1: { size: 70, line: 87, letter: 1.25, upper: true, family: "heading" },
    h2: { size: 40, line: 54, letter: 1.25, upper: true, family: "heading" },
    h3: { size: 24, line: 32, letter: 0, upper: false, family: "body", weight: 900 },
    h4: { size: 20, line: 28, letter: 0, upper: false, family: "body", weight: 400 },
    h5: { size: 18, line: 24, letter: 1, upper: true, family: "heading" },
    button: { size: 20, line: 24, letter: 1, upper: true, family: "heading" },
    body: { size: 16, line: 26, letter: 0, upper: false, family: "body", weight: 400 },
  },
} as const;

export type Brand = typeof brand;
