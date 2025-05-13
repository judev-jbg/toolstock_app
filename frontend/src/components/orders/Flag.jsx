import useFetchFlag from "../hooks/useFetchFlag";

// eslint-disable-next-line react/prop-types
const Flag = ({ channel }) => {
  const flagImage = useFetchFlag(channel);

  return (
    <figure className="container-flag">
      {flagImage && <img src={flagImage} alt={channel} className="flag" />}
    </figure>
  );
};

export default Flag;
