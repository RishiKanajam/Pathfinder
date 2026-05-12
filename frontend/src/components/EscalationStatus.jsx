import './EscalationStatus.css';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export function EscalationStatus({ escalation }) {
  if (!escalation) {
    return null;
  }

  const getCurrentLayer = () => {
    if (escalation.layer_4_triggered) return 4;
    if (escalation.layer_3_triggered) return 3;
    return 2;
  };

  const getLayerColor = (layer) => {
    return {
      2: "yellow",
      3: "orange",
      4: "red",
    }[layer];
  };

  const getLayerLabel = (layer) => {
    return {
      2: "Staff Notified",
      3: "Re-alert in Progress",
      4: "CEO Escalation - System Failure",
    }[layer];
  };

  const currentLayer = getCurrentLayer();
  const layerColor = getLayerColor(currentLayer);

  return (
    <div className={`escalation-status layer-${currentLayer} color-${layerColor}`}>
      <div className="escalation-header">
        <div className="badge-container">
          {currentLayer === 4 ? (
            <AlertTriangle className="badge-icon critical" size={20} />
          ) : currentLayer === 3 ? (
            <AlertCircle className="badge-icon warning" size={20} />
          ) : (
            <Clock className="badge-icon info" size={20} />
          )}
          <span className={`badge ${layerColor}`}>
            LAYER {currentLayer}
          </span>
        </div>
        <span className="layer-label">{getLayerLabel(currentLayer)}</span>
      </div>

      {escalation.acknowledged_at ? (
        <div className="escalation-acknowledged">
          <CheckCircle size={18} className="check-icon" />
          <div>
            <p className="acknowledged-text">✓ Acknowledged</p>
            <p className="response-time">
              Response time: {Math.round(escalation.response_time_seconds / 60)} minutes
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="escalation-unacknowledged">
            <AlertCircle size={18} className="alert-icon" />
            <div>
              <p className="unacknowledged-text">⚠ Unacknowledged</p>
              <p className="time-elapsed">
                Waiting for staff response...
              </p>
            </div>
          </div>

          {currentLayer > 2 && (
            <div className="critical-notice">
              <AlertTriangle size={16} />
              <p>🚨 Escalation in progress - attempting to reach additional staff</p>
            </div>
          )}

          {escalation.is_system_failure && (
            <div className="system-failure-notice">
              <AlertTriangle size={16} />
              <p>CRITICAL: System failure - escalation unacknowledged for 15+ minutes. CEO notification sent.</p>
              <p className="review-note">Post-incident review required.</p>
            </div>
          )}
        </>
      )}

      <div className="escalation-details">
        <div className="detail-item">
          <span className="label">Risk Level:</span>
          <span className={`value risk-${escalation.risk_level}`}>{escalation.risk_level.toUpperCase()}</span>
        </div>
        <div className="detail-item">
          <span className="label">Risk Score:</span>
          <span className="value">{(escalation.risk_score * 100).toFixed(0)}%</span>
        </div>
        <div className="detail-item">
          <span className="label">Staff Notified:</span>
          <span className="value">{escalation.layer_2_sent_to?.length || 0} staff member(s)</span>
        </div>
      </div>
    </div>
  );
}

export default EscalationStatus;
