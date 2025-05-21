// frontend/src/components/catalog/CompetitorPanel.jsx
import React from "react";
import "./CompetitorPanel.css";
import { FaAmazon, FaTrophy, FaBoxes } from "react-icons/fa";
import { formatCurrency } from "../../utils/formatters";

const CompetitorPanel = ({ product, competitorPrices, onOptimizePrice }) => {
  const hasBuyBox = competitorPrices?.some(
    (cp) => cp.hasBuyBox && cp.sellerId === "your-seller-id"
  );
  const lowestPrice = competitorPrices?.length > 0 ? competitorPrices[0] : null;

  return (
    <div className="competitor-panel">
      <div className="competitor-header">
        <h3>
          <FaAmazon /> Análisis de Competencia
        </h3>
        <button className="optimize-button" onClick={onOptimizePrice}>
          Optimizar Precio
        </button>
      </div>

      <div className="competitor-status">
        <div className="status-item">
          <div className="status-label">Tu precio actual</div>
          <div className="status-value">
            {formatCurrency(product?.amazonPrice)}
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Precio mínimo</div>
          <div className="status-value">
            {formatCurrency(product?.minPrice)}
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Buy Box</div>
          <div
            className={`status-badge ${hasBuyBox ? "positive" : "negative"}`}
          >
            <FaTrophy />{" "}
            {hasBuyBox ? "Tienes el Buy Box" : "No tienes el Buy Box"}
          </div>
        </div>
      </div>

      <div className="competitors-table-container">
        <table className="competitors-table">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Precio</th>
              <th>FBA</th>
              <th>Buy Box</th>
            </tr>
          </thead>
          <tbody>
            {competitorPrices?.length > 0 ? (
              competitorPrices.map((competitor) => (
                <tr
                  key={competitor._id}
                  className={competitor.isAmazon ? "amazon-seller" : ""}
                >
                  <td className="seller-cell">
                    {competitor.isAmazon ? (
                      <>
                        <FaAmazon /> Amazon
                      </>
                    ) : (
                      competitor.sellerName
                    )}
                  </td>
                  <td>{formatCurrency(competitor.price)}</td>
                  <td>
                    {competitor.isFBA ? (
                      <span className="fba-badge">
                        <FaBoxes /> FBA
                      </span>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td>
                    {competitor.hasBuyBox ? (
                      <span className="buybox-badge">
                        <FaTrophy />
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="no-data">
                  No hay datos de competencia disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="recommendation">
        {lowestPrice && product?.minPrice && (
          <>
            <h4>Recomendación</h4>
            {lowestPrice.price > product.minPrice ? (
              <p>
                Puedes bajar tu precio a{" "}
                <strong>
                  {formatCurrency(
                    Math.max(lowestPrice.price - 2, product.minPrice)
                  )}
                </strong>{" "}
                para ganar el Buy Box (2€ menos que la competencia).
              </p>
            ) : (
              <p>
                El precio de la competencia está por debajo de tu precio mínimo.
                No puedes bajarlo más de{" "}
                <strong>{formatCurrency(product.minPrice)}</strong>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CompetitorPanel;
