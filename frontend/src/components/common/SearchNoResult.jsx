import React from "react";
import searchNoResultSvg from "../../assets/img/search-no-result.svg";

const SearchNoResult = ({
  width = "200px",
  height = "200px",
  className = "",
}) => {
  return (
    <div className={`no-results-container ${className}`}>
      <figure className={`no-results-img ${className}`}>
        <img
          src={searchNoResultSvg}
          alt="No se encontraron resultados"
          width="100%"
          height="auto"
        />
      </figure>
      <p>No se encontraron órdenes para este filtro</p>
    </div>
  );
};

export default SearchNoResult;
