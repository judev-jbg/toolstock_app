import React from "react";
import "./OrdersFilter.css";

const OrdersFilter = ({ filters, activeFilter, onFilterChange }) => {
  return (
    <div className="orders-filter">
      {filters.map((filter) => (
        <React.Fragment key={filter.id}>
          {filter.newBlock && <span className="filter-divider"></span>}
          <button
            className={`filter-button ${
              activeFilter === filter.id ? "active" : ""
            }`}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
            {filter.count > 0 && (
              <span
                className={`filter-count ${
                  filter.count > 0 ? "has-items" : ""
                }`}
              >
                {filter.count}
              </span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default OrdersFilter;
