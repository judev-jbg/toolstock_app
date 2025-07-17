import { useState, useEffect } from "react";
import { useNotification } from "../contexts/NotificationContext";

export const useApi = (apiFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showError } = useNotification();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiFunction();
        setData(result);
      } catch (err) {
        setError(err);
        showError(err.response?.data?.message || "Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, dependencies);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction();
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      showError(err.response?.data?.message || "Error al cargar los datos");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
};
