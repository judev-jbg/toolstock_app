import React from "react";
import "./Input.css";

const Input = ({
  label,
  type = "text",
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  icon,
  fullWidth = false,
  className = "",
  ...props
}) => {
  const inputClasses = `input-container ${error ? "error" : ""} ${
    fullWidth ? "full-width" : ""
  } ${className}`;

  return (
    <div className={inputClasses}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          {...props}
        />
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  );
};

export default Input;
