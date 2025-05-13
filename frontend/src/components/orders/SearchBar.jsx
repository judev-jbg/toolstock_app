import { MdOutlineManageSearch } from "react-icons/md";

// eslint-disable-next-line react/prop-types
const SearchBar = ({ handlerModalSearch }) => {
  return (
    <>
      <span className="search-bar" onClick={handlerModalSearch}>
        <span className="search-icon">
          <MdOutlineManageSearch />
        </span>
        <input type="text" placeholder="Buscar pedido..." className="input" />
      </span>
    </>
  );
};

export default SearchBar;
