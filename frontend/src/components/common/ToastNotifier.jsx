import React from "react";

const ToastNotifier = ({ message, type }) => {
  return (
    <div className={`toast-container ${type}`}>
      <div className="toast-content">
        {type === "success" && (
          <div className="toast-icon success">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        )}
        {type === "error" && (
          <div className="toast-icon error">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}
        <div className="toast-message">{message}</div>
      </div>
    </div>
  );
};

export default ToastNotifier;
