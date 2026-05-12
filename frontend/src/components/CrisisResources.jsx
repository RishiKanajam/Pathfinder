import './CrisisResources.css';

export function CrisisResources({ riskLevel = "medium", prominent = false }) {
  const crisisNumbers = [
    { label: "000", description: "Emergency - Immediate danger", href: "tel:000" },
    { label: "Lifeline", description: "13 11 14 (24/7, free)", href: "tel:131114" },
    { label: "Crisis Chat", description: "lifeline.org.au", href: "https://www.lifeline.org.au" },
    { label: "NSW Mental Health Line", description: "1800 011 511 (24/7)", href: "tel:1800011511" },
    { label: "13YARN", description: "13 92 76 (Aboriginal & Torres Strait Islander)", href: "tel:1392762" },
    { label: "Beyond Blue", description: "1300 22 4636", href: "tel:1300224636" },
    { label: "Suicide Call Back Service", description: "1300 659 467", href: "tel:1300659467" },
  ];

  const visibilityClass = prominent ? "prominent" : "available";
  const containerClass = `crisis-resources ${visibilityClass} risk-${riskLevel}`;

  return (
    <div className={containerClass}>
      <div className="crisis-header">
        <h3>Crisis Support Available Now</h3>
        {prominent && <p className="urgent-message">If you're in immediate danger, these services are available 24/7</p>}
      </div>
      
      <div className="crisis-buttons">
        {crisisNumbers.map((item, idx) => (
          <a
            key={idx}
            href={item.href}
            className={`crisis-button ${item.label === "000" && prominent ? "primary" : ""}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="button-label">{item.label}</div>
            <div className="button-description">{item.description}</div>
          </a>
        ))}
      </div>

      {prominent && (
        <p className="safety-note">
          You don't have to sort it all out tonight. Real people are available right now.
        </p>
      )}
    </div>
  );
}

export default CrisisResources;
