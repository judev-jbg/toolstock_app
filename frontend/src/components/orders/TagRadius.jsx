import { useState } from "react";
import getBackgroundTagRadius from "../services/ConfigTagRadius";

// eslint-disable-next-line react/prop-types
const TagRadius = ({ label, tooltipText }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="tag-radius"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: getBackgroundTagRadius(label),
      }}
    >
      {label}
      {isHovered && <div className="tooltip">{tooltipText}</div>}
    </div>
  );
};

export default TagRadius;
