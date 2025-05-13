const OrderSkeleton = () => {
  return (
    <div className="order-skeleton">
      <div className="order-skeleton-header">
        <div className="skeleton-line skeleton-header-top"></div>
        <div className="skeleton-line skeleton-header-bottom"></div>
      </div>
      <div className="order-skeleton-body">
        <div className="skeleton-section">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
        <div className="skeleton-section">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
        <div className="skeleton-section">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
        </div>
      </div>
      <div className="order-skeleton-product">
        <div className="skeleton-line skeleton-product-top"></div>
        <div className="skeleton-product-details">
          <div className="skeleton-block skeleton-block-img"></div>
          <div className="skeleton-block skeleton-block-description"></div>
          <div className="skeleton-block"></div>
          <div className="skeleton-block"></div>
          <div className="skeleton-block"></div>
          <div className="skeleton-block"></div>
          <div className="skeleton-block"></div>
          <div className="skeleton-block"></div>
        </div>
      </div>
    </div>
  );
};

export default OrderSkeleton;
