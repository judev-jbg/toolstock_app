import appLogo from "../../assets/img/logo-app.png";

const Logo = () => {
  return (
    <>
      <figure className="container-logo">
        <img src={appLogo} alt="App Logo" className="logo" />
      </figure>
    </>
  );
};

export default Logo;
