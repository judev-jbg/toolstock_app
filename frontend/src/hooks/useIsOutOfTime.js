const useIsOutOfTime = (date) => {
  // Convertir la fecha proporcionada a objeto Date
  const targetDate = new Date(date);

  // Obtener la fecha actual
  const currentDate = new Date();

  // Normalizar ambas fechas para comparar solo día, mes y año
  const normalizedTargetDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );

  const normalizedCurrentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  // Verificar si la fecha objetivo es menor o igual a la fecha actual
  // (ignorando hora, minutos y segundos)
  const shouldRenderWitness = normalizedTargetDate <= normalizedCurrentDate;
  return shouldRenderWitness;
};

export default useIsOutOfTime;
