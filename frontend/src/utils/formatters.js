export const formatCurrency = (amount, currency = "EUR") => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(amount || 0);
};

export const formatNumber = (number) => {
  return new Intl.NumberFormat("es-ES").format(number || 0);
};

export const formatDate = (date) => {
  if (!date) return "";

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

export const formatDateShort = (date) => {
  if (!date) return "";

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
};

export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export const getInitials = (name) => {
  if (!name) return "";

  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
};
