// frontend/src/components/integrations/SyncPanel.jsx

import React, { useState } from "react";
import {
  FaSync,
  FaAmazon,
  FaShoppingCart,
  FaExchangeAlt,
  FaTruckLoading,
} from "react-icons/fa";
import Button from "../common/Button";
import { integrationService } from "../../services/api";
import "./SyncPanel.css";

const SyncPanel = ({ onSyncComplete }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncType, setSyncType] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  // Manejar sincronización de Amazon
  const handleSyncAmazon = async () => {
    try {
      setSyncing(true);
      setSyncType("amazon");
      setError(null);

      const result = await integrationService.syncAmazonOrders(3); // Últimos 3 días

      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (error) {
      console.error("Error al sincronizar pedidos de Amazon:", error);
      setError(
        "Error al sincronizar pedidos de Amazon: " +
          (error.message || "Error desconocido")
      );
    } finally {
      setSyncing(false);
    }
  };

  // Manejar sincronización de Prestashop
  const handleSyncPrestashop = async () => {
    try {
      setSyncing(true);
      setSyncType("prestashop");
      setError(null);

      const result = await integrationService.syncPrestashopOrders(3); // Últimos 3 días

      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (error) {
      console.error("Error al sincronizar pedidos de Prestashop:", error);
      setError(
        "Error al sincronizar pedidos de Prestashop: " +
          (error.message || "Error desconocido")
      );
    } finally {
      setSyncing(false);
    }
  };

  // Manejar sincronización de Amazon a Prestashop
  const handleSyncFromAmazon = async () => {
    try {
      setSyncing(true);
      setSyncType("amazon-to-prestashop");
      setError(null);

      const result = await integrationService.syncFromAmazon({
        days: 3,
        onlyNew: true,
      });

      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (error) {
      console.error(
        "Error al sincronizar pedidos de Amazon a Prestashop:",
        error
      );
      setError(
        "Error al sincronizar pedidos de Amazon a Prestashop: " +
          (error.message || "Error desconocido")
      );
    } finally {
      setSyncing(false);
    }
  };

  // Manejar sincronización completa
  const handleFullSync = async () => {
    try {
      setSyncing(true);
      setSyncType("full");
      setError(null);

      const result = await integrationService.fullSync();

      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (error) {
      console.error("Error en la sincronización completa:", error);
      setError(
        "Error en la sincronización completa: " +
          (error.message || "Error desconocido")
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="sync-panel">
      <h2 className="sync-panel-title">Sincronización de Datos</h2>

      <div className="sync-buttons">
        <Button
          variant="outline"
          icon={<FaAmazon />}
          onClick={handleSyncAmazon}
          disabled={syncing}
          className="sync-button"
        >
          {syncType === "amazon" && syncing
            ? "Sincronizando..."
            : "Sincronizar Amazon"}
        </Button>

        <Button
          variant="outline"
          icon={<FaShoppingCart />}
          onClick={handleSyncPrestashop}
          disabled={syncing}
          className="sync-button"
        >
          {syncType === "prestashop" && syncing
            ? "Sincronizando..."
            : "Sincronizar Prestashop"}
        </Button>

        <Button
          variant="outline"
          icon={<FaExchangeAlt />}
          onClick={handleSyncFromAmazon}
          disabled={syncing}
          className="sync-button"
        >
          {syncType === "amazon-to-prestashop" && syncing
            ? "Sincronizando..."
            : "Amazon → Prestashop"}
        </Button>

        <Button
          icon={<FaSync />}
          onClick={handleFullSync}
          disabled={syncing}
          className="sync-button full"
        >
          {syncType === "full" && syncing
            ? "Sincronización completa..."
            : "Sincronización Completa"}
        </Button>
      </div>

      {error && <div className="sync-error">{error}</div>}

      {syncResult && (
        <div className="sync-result">
          <h3>Resultado de la sincronización</h3>

          {syncType === "amazon" && (
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">Total procesados:</span>
                <span className="stat-value">{syncResult.stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Creados:</span>
                <span className="stat-value">{syncResult.stats.created}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Actualizados:</span>
                <span className="stat-value">{syncResult.stats.updated}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Errores:</span>
                <span className="stat-value">{syncResult.stats.errors}</span>
              </div>
            </div>
          )}

          {syncType === "prestashop" && (
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">Total procesados:</span>
                <span className="stat-value">{syncResult.stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Creados:</span>
                <span className="stat-value">{syncResult.stats.created}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Actualizados:</span>
                <span className="stat-value">{syncResult.stats.updated}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Errores:</span>
                <span className="stat-value">{syncResult.stats.errors}</span>
              </div>
            </div>
          )}

          {syncType === "amazon-to-prestashop" && (
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">Total procesados:</span>
                <span className="stat-value">{syncResult.stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Sincronizados:</span>
                <span className="stat-value">{syncResult.stats.synced}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Omitidos:</span>
                <span className="stat-value">{syncResult.stats.skipped}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Errores:</span>
                <span className="stat-value">{syncResult.stats.errors}</span>
              </div>
            </div>
          )}

          {syncType === "full" && (
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">Amazon:</span>
                <span className="stat-value">
                  {syncResult.amazon.created} creados,{" "}
                  {syncResult.amazon.updated} actualizados
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Prestashop:</span>
                <span className="stat-value">
                  {syncResult.prestashop.created} creados,{" "}
                  {syncResult.prestashop.updated} actualizados
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Amazon → Prestashop:</span>
                <span className="stat-value">
                  {syncResult.amazonToPrestashop.synced} sincronizados
                </span>
              </div>
              {syncResult.statusSync && (
                <div className="stat-item">
                  <span className="stat-label">Estados:</span>
                  <span className="stat-value">
                    {syncResult.statusSync.updated} actualizados
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyncPanel;
