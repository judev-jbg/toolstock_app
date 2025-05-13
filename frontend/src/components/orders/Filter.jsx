// eslint-disable-next-line react/prop-types
const Filter = ({ id, label, counter, newBlock, active, onClick }) => {
  return (
    <>
      {newBlock && <span className="new-block"></span>}
      <span
        className={`filter ${active ? "active" : ""}`}
        onClick={() => onClick(id)}
      >
        {label}
        <span className={`counter ${counter > 0 ? "flagger" : ""}`}>
          {counter}
        </span>
      </span>
    </>
  );
};

export default Filter;
