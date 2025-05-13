import { useMemo } from "react";

const useAddressFormatter = (addressData) => {
  return useMemo(() => {
    if (!addressData) return "";

    const {
      shipAddress1,
      shipAddress2,
      shipAddress3,
      shipPostalCode,
      shipCity,
      shipState,
      billAddress1,
      billAddress2,
      billAddress3,
      billPostalCode,
      billCity,
      billState,
    } = addressData;

    // Array para almacenar las partes de la dirección en orden
    const addressParts = [];

    // Verificar y añadir shipAddress1
    if (shipAddress1) {
      addressParts.push(shipAddress1);
    }

    // Verificar y añadir shipAddress2
    if (shipAddress2) {
      addressParts.push(shipAddress2);
    }

    // Verificar y añadir shipAddress3
    if (shipAddress3) {
      addressParts.push(shipAddress3);
    }

    // Verificar y añadir shipPostalCode
    if (shipPostalCode) {
      addressParts.push(shipPostalCode);
    }

    // Verificar y añadir billAddress1
    if (billAddress1) {
      addressParts.push(billAddress1);
    }

    // Verificar y añadir billAddress2
    if (billAddress2) {
      addressParts.push(billAddress2);
    }

    // Verificar y añadir billAddress3
    if (billAddress3) {
      addressParts.push(billAddress3);
    }

    // Verificar y añadir billPostalCode
    if (billPostalCode) {
      addressParts.push(billPostalCode);
    }

    // Verificar y añadir shipCity con la condición especial
    if (shipCity) {
      // Si no hay código postal, añadimos la ciudad normalmente
      if (!shipPostalCode) {
        addressParts.push(shipCity);
      } else {
        // Si hay código postal, concatenamos la ciudad sin coma separadora
        const lastIndex = addressParts.length - 1;
        addressParts[lastIndex] = `${addressParts[lastIndex]} ${shipCity}`;
      }
      // Verificar y añadir billCity con la condición especial
    } else if (billCity) {
      // Si no hay código postal, añadimos la ciudad normalmente
      if (!billPostalCode) {
        addressParts.push(billCity);
      } else {
        // Si hay código postal, concatenamos la ciudad sin coma separadora
        const lastIndex = addressParts.length - 1;
        addressParts[lastIndex] = `${addressParts[lastIndex]} ${billCity}`;
      }
    }

    // Verificar y añadir shipState
    if (shipState) {
      addressParts.push(shipState);
    }
    // Verificar y añadir billState
    if (billState) {
      addressParts.push(billState);
    }

    // Unir todas las partes con comas y espacios
    return addressParts.join(", ");
  }, [addressData]);
};

export default useAddressFormatter;
