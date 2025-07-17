import React, { useState } from "react";
import { Box } from "@mui/material";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

export const AppLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const drawerWidth = sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${drawerWidth}px)`,
          minHeight: "100dvh",
          bgcolor: "background.default",
        }}
      >
        <Header sidebarCollapsed={sidebarCollapsed} />

        <Box
          sx={{
            p: 3,
            mt: 10, // Height of AppBar
            minHeight: "calc(100dvh - 80px)",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
