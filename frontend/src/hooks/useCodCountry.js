import { useMemo } from "react";
const useCodCountry = () => {
  const countries = useMemo(
    () => ({
      DE: 49,
      AT: "AUSTRIA",
      DK: "DINAMARCA",
      IT: 39,
      FR: "FRANCIA",
      IE: "IRLANDA",
      LV: "LETONIA",
      HR: "CROACIA",
      PT: 351,
      SI: "ESLOVENIA",
      LU: "LUXEMBURGO",
      GR: "GRECIA",
      FI: "FINLANDIA",
      NL: "HOLANDA",
      LT: "LITUANIA",
      CZ: "REP. CHECA        ",
      BE: "BELGICA",
      SK: "ESLOVAQUIA",
      MT: "MALTA",
      EE: "ESTONIA",
      RO: "RUMANIA",
      ES: 34,
      PL: "POLONIA",
      HU: "HUNGRIA",
      BG: "BULGARIA",
      CY: "CHIPRE",
      SE: "SUECIA",
      CH: "SUIZA",
      LI: "LIECHTENSTEIN",
      GB: "REINO UNIDO",
      US: "ESTADOS UNIDOS",
    }),
    []
  );

  // La función que retorna el hook
  const getCountryCode = (countryCod) => {
    if (countries[countryCod]) {
      return countries[countryCod];
    } else {
      return "País no encontrado: " + countryCod;
    }
  };

  return getCountryCode;
};

export default useCodCountry;
