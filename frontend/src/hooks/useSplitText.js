import { useState, useEffect } from "react";

const useSplitText = (text) => {
  const [firstPartText, setFirstPartText] = useState("");
  const [secondPartText, setSecondPartText] = useState("");

  useEffect(() => {
    if (text) {
      const words = text.split(" "); // Separar la cadena en palabras
      const midIndex = Math.ceil(words.length / 2); // Calcular el índice medio

      // Concatenar las palabras para las dos partes
      const firstPart = words.slice(0, midIndex).join(" "); // Primeras palabras
      const secondPart = words.slice(midIndex).join(" "); // Palabras restantes

      // Asignar las partes a los estados
      setFirstPartText(firstPart);
      setSecondPartText(secondPart);
    }
  }, [text]);

  return { firstPartText, secondPartText };
};

export default useSplitText;
