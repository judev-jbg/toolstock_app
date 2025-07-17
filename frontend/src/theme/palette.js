export const palette = (mode) => ({
  mode,
  primary: {
    main: "#738dff",
    light: "#4666f1",
    dark: "#5164b8",
    contrastText: "#000",
  },
  secondary: {
    main: "#353535",
    light: "#555555",
    dark: "#2d2d2d",
    contrastText: "#fff",
  },
  error: {
    main: "#fd5957",
    light: "#ff8a80",
    dark: "#cf4b49",
  },
  warning: {
    main: "#ff9800",
    light: "#ffb74d",
    dark: "#f57c00",
  },
  success: {
    main: "#4caf50",
    light: "#81c784",
    dark: "#388e3c",
  },
  background: {
    default: mode === "dark" ? "#242424" : "#fafafa",
    paper: mode === "dark" ? "#2d2d2d" : "#ffffff",
  },
  text: {
    primary: mode === "dark" ? "rgba(255, 255, 255, 0.87)" : "#213547",
    secondary:
      mode === "dark" ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)",
  },
});
