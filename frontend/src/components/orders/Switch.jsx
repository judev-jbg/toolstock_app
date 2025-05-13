import { useState } from "react";
// eslint-disable-next-line react/prop-types
const Switch = ({ label, checked, onChange, id, action }) => {
  const [isChecked, setIsChecked] = useState(checked);

  const handleSwitchChange = (event) => {
    setIsChecked(event.target.checked);
    onChange(id, event.target.checked, action);
  };

  return (
    <label className="switch-container">
      <label className="switch-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="switch-checkbox"
        type="checkbox"
        id={id}
        checked={isChecked || 0}
        onChange={handleSwitchChange}
      />
      <div className="switch"></div>
    </label>
  );
};

export default Switch;
