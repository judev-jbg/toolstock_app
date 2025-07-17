import { createTheme } from "@mui/material/styles";
import { palette } from "./palette";
import { typography } from "./typography";

export const createAppTheme = (mode) => {
  return createTheme({
    palette: palette(mode),
    typography,
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: "none",
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid rgba(224, 224, 224, 1)",
            },
          },
        },
      },
    },
    transitions: {
      easing: {
        easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
        easeOut: "cubic-bezier(0.0, 0, 0.2, 1)",
        easeIn: "cubic-bezier(0.4, 0, 1, 1)",
        sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
      },
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
  });
};
