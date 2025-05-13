import { useCallback } from "react";

const useCopyToClipboard = () => {
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Texto copiado al portapapeles:", text);
      })
      .catch((err) => {
        console.error("Error al copiar el texto: ", err);
      });
  }, []);

  return copyToClipboard;
};

export default useCopyToClipboard;
