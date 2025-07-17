import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AppThemeProvider } from "./contexts/ThemeContext.jsx";
import { NotificationProvider } from "./contexts/NotificationContext.jsx";
import { AlertProvider } from "./contexts/AlertContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppThemeProvider>
        <NotificationProvider>
          <AlertProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </AlertProvider>
        </NotificationProvider>
      </AppThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
