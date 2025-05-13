import Filter from "./Filter";

// eslint-disable-next-line react/prop-types
const Filters = ({ filters, onFilterClick }) => {
  return (
    <div className="filters">
      <div className="filters-container">
        {filters.map((item) => (
          <Filter
            key={item.id}
            id={item.id}
            label={item.label}
            counter={item.counter}
            newBlock={item.newBlock}
            active={item.active}
            onClick={onFilterClick}
          />
        ))}
      </div>
    </div>
  );
};

export default Filters;
