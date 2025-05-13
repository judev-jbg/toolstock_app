import { useState } from "react";
import useSplitText from "../hooks/useSplitText";
import useCopyToClipboard from "../hooks/useCopyToClipboard";
import { FaClipboard } from "react-icons/fa";
// eslint-disable-next-line react/prop-types
const Label = ({ text, tooltipText, positionTooltip, needSplit }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveredIconCopy, setIsHoveredIconCopy] = useState(false);
  const { firstPartText, secondPartText } = useSplitText(text);
  const copyToClipboard = useCopyToClipboard();

  const handleCopySingle = (text) => {
    copyToClipboard(text);
  };

  const handleCopyBoth = () => {
    if (needSplit) {
      const concatenatedText = `${firstPartText}, ${secondPartText}`;
      copyToClipboard(concatenatedText);
    }
  };

  return (
    <span
      className="label-info"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {needSplit ? (
        <>
          <span
            className={`label-info-copy ${
              isHoveredIconCopy ? "hoveredIconCopy" : ""
            }`}
            onClick={() => handleCopySingle(firstPartText)}
          >
            {firstPartText}
          </span>
          <span
            className={`label-info-copy ${
              isHoveredIconCopy ? "hoveredIconCopy" : ""
            }`}
            onClick={() => handleCopySingle(secondPartText)}
          >
            , {secondPartText}
          </span>
          {isHovered && (
            <span
              className="label-info-copy copy-full"
              onClick={handleCopyBoth}
              onMouseEnter={() => setIsHoveredIconCopy(true)}
              onMouseLeave={() => setIsHoveredIconCopy(false)}
            >
              <FaClipboard />
            </span>
          )}
        </>
      ) : (
        <span
          className="label-info-copy"
          onClick={() => handleCopySingle(text)}
        >
          {text}
        </span>
      )}
      {isHovered && (
        <span
          className={`tooltip-label-info tooltip-label-info-${positionTooltip}`}
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
};

export default Label;
