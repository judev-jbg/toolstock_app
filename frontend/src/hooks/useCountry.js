import { useMemo } from "react";
const useCountry = () => {
  const countries = useMemo(
    () => ({
      DE: "ALEMANIA",
      AT: "AUSTRIA",
      DK: "DINAMARCA",
      IT: "ITALIA",
      FR: "FRANCIA",
      IE: "IRLANDA",
      LV: "LETONIA",
      HR: "CROACIA",
      PT: "PORTUGAL",
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
      ES: "ESPAÑA",
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
  const getCountryName = (countryCod) => {
    if (countries[countryCod]) {
      return countries[countryCod];
    } else {
      return "País no encontrado: " + countryCod;
    }
  };

  return getCountryName;
};

export default useCountry;
