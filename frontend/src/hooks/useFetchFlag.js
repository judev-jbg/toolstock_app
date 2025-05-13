import { useState, useEffect } from "react";
import esFlag from "../assets/img/es.svg";
import deFlag from "../assets/img/de.svg";
import itFlag from "../assets/img/it.svg";
import nlFlag from "../assets/img/nl.svg";
import beFlag from "../assets/img/be.svg";

const useFetchFlag = (channel) => {
  const [flagImage, setFlagImage] = useState("");

  useEffect(() => {
    const fetchFlagImage = () => {
      switch (channel) {
        case "Amazon.es":
          setFlagImage(esFlag);
          break;
        case "Amazon.de":
          setFlagImage(deFlag);
          break;
        case "Amazon.it":
          setFlagImage(itFlag);
          break;
        case "Amazon.nl":
          setFlagImage(nlFlag);
          break;
        case "Amazon.be":
          setFlagImage(beFlag);
          break;
        default:
          setFlagImage(""); // O una imagen por defecto
      }
    };

    fetchFlagImage();
  }, [channel]);

  return flagImage;
};

export default useFetchFlag;
