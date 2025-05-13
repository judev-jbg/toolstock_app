import SearchBar from "./SearchBar";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";

// eslint-disable-next-line react/prop-types
const Header = ({ handlerModalSearch, showButton, ready }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate("/orders-shipments-history");
  };
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <Logo />
        </div>
        <div className="header-action">
          {!ready && (
            <button className="button-line" onClick={handleClick}>
              <span>Historial de envíos</span>
            </button>
          )}
          {showButton && <Button />}
        </div>
        <div className="header-search">
          <SearchBar handlerModalSearch={handlerModalSearch} />
        </div>
      </div>
    </header>
  );
};

export default Header;
