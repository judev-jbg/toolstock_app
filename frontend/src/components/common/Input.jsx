import React, { useState } from "react";
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
  const [isFocused, setIsFocused] = useState(false);
  const inputClasses = `md-input-container ${error ? "error" : ""} ${
    fullWidth ? "full-width" : ""
  } ${className}`;

  const hasValue = value !== undefined && value !== "";
  const showLabel = isFocused || hasValue || placeholder;

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div className={inputClasses}>
      <div
        className={`md-input-outline ${isFocused ? "focused" : ""} ${
          hasValue ? "has-value" : ""
        }`}
      >
        {icon && <span className="md-input-icon">{icon}</span>}

        {type === "textarea" ? (
          <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="md-input md-textarea"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        ) : (
          <input
            type={type}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="md-input"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        )}

        {label && (
          <label
            htmlFor={id}
            className={`md-input-label ${showLabel ? "active" : ""} ${
              icon ? "with-ico" : ""
            }`}
          >
            {label}
          </label>
        )}

        <fieldset className={`md-input-fieldset ${icon ? "with-ico" : ""}`}>
          <legend
            className={`md-input-legend ${showLabel ? "active" : ""} ${
              icon ? "with-ico" : ""
            }`}
          >
            {label ? <span>{label}</span> : <span>&nbsp;</span>}
          </legend>
        </fieldset>
      </div>

      {error && <span className="md-input-error">{error}</span>}
    </div>
  );
};

export default Input;
