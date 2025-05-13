import { useState } from "react";
import { FaSearch } from "react-icons/fa";
import { IoCloseOutline } from "react-icons/io5";
import api from "../../services/api";

// eslint-disable-next-line react/prop-types
export default function SearchBarModal({
  open,
  close,
  setOrders,
  setItemsFilter,
}) {
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  if (!open) return null;
  document.getElementsByTagName("html")[0].style.overflow = "hidden";

  const searchOrder = async () => {
    if (!search.trim()) return;

    try {
      setIsSearching(true);
      const response = await api.get(`/order/${search}`);

      // Asignar la respuesta a orders en TsOrdersApp
      setOrders([response.data]);

      // Desactivar todos los filtros
      setItemsFilter((prevFilters) =>
        prevFilters.map((filter) => ({
          ...filter,
          active: false,
        }))
      );

      // Cerrar el modal después de la búsqueda exitosa
      close();
    } catch (error) {
      console.error("Error al buscar la orden:", error);
      // Aquí puedes manejar los errores, por ejemplo, mostrar un mensaje
    } finally {
      setIsSearching(false);
    }
  };

  // Manejar la pulsación de teclas en el input
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter") {
      searchOrder();
    }
  };
  return (
    <div
      className="searchBarModal-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="searchBarModal">
        <input
          onKeyDown={handleKeyDown}
          type="text"
          placeholder="Buscar pedido o envío..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="inputSearch"
          disabled={isSearching}
        />
        {search && (
          <span className="search-icon-modal clear">
            <IoCloseOutline onClick={() => setSearch("")} />
          </span>
        )}

        <span
          className={`search-icon-modal ${isSearching ? "searching" : ""}`}
          onClick={searchOrder}
        >
          <FaSearch />
        </span>
      </div>
    </div>
  );
}
