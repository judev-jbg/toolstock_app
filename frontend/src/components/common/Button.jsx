import React from "react";
import "./Button.css";

const Button = ({
  children,
  type = "button",
  variant = "filled",
  size = "medium",
  onClick,
  disabled = false,
  fullWidth = false,
  icon,
  rounded = false,
  className = "",
  ...props
}) => {
  // Solo aplicar rounded en variantes que lo permiten (todos excepto text y fab)
  const shouldApplyRounded = rounded && variant !== "text" && variant !== "fab";

  // FAB siempre es redondeado
  const isFab = variant === "fab";

  const buttonClasses = `md-button ${variant} ${size} ${
    fullWidth ? "full-width" : ""
  } ${shouldApplyRounded ? "rounded" : ""} ${isFab ? "fab" : ""} ${className}`;

  // Si está deshabilitado, renderizar un span/div en lugar de button
  if (disabled) {
    return (
      <div className={`${buttonClasses} disabled`} aria-disabled="true">
        {icon && <span className="md-button-icon">{icon}</span>}
        {children}
      </div>
    );
  }

  // Si no está deshabilitado, renderizar un button normal
  return (
    <button type={type} className={buttonClasses} onClick={onClick} {...props}>
      {icon && <span className="md-button-icon">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
