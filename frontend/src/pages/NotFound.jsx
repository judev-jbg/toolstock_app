import React from "react";
import { Box, Typography, Button, Container } from "@mui/material";
import { RiHome3Fill as HomeIcon } from "react-icons/ri";
import { useNavigate } from "react-router-dom";

export const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/dashboard");
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          py: 4,
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: "8rem",
            fontWeight: "bold",
            background:
              "linear-gradient(45deg,rgb(125, 148, 250),rgb(50, 87, 253))",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 2,
          }}
        >
          404
        </Typography>

        <Typography variant="h4" component="h1" gutterBottom>
          Página no encontrada
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Lo sentimos, la página que estás buscando no existe o no tienes
          permisos para acceder a ella.
        </Typography>

        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          onClick={handleGoHome}
          sx={{
            mt: 3,
            background:
              "linear-gradient(45deg,rgb(126, 150, 255),rgb(60, 93, 240))",
            "&:hover": {
              background:
                "linear-gradient(45deg,rgb(121, 143, 241),rgb(67, 88, 180))",
            },
            color: "#f5f5f5",
          }}
        >
          Volver al inicio
        </Button>
      </Box>
    </Container>
  );
};
