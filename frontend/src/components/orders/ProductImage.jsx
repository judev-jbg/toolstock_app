import React, { useState, useEffect } from "react";
import imgProductDefault from "../assets/img/not-available.png";
const ProductImage = ({ referenciaProv, productName }) => {
  const [imgSrc, setImgSrc] = useState(imgProductDefault);

  useEffect(() => {
    if (!referenciaProv) return;

    // En Vite, podemos usar la función import.meta.url para resolver rutas
    const tryLoadImage = async () => {
      try {
        // Intentar cargar la imagen
        const imageUrl = new URL(
          `/src/assets/img/products/${referenciaProv}.jpg`,
          import.meta.url
        ).href;

        // Verificar si la imagen existe
        const response = await fetch(imageUrl, { method: "HEAD" });
        if (response.ok) {
          setImgSrc(imageUrl);
        } else {
          setImgSrc(imgProductDefault);
        }
      } catch (error) {
        console.log("Error al cargar la imagen:", error);
        setImgSrc(imgProductDefault);
      }
    };

    tryLoadImage();
  }, [referenciaProv]);

  return (
    <img
      alt={productName || "Producto"}
      loading="lazy"
      decoding="async"
      src={imgSrc}
      onError={() => setImgSrc(imgProductDefault)}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
};

export default ProductImage;
