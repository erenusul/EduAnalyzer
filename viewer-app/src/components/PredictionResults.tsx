/**
 * Tekrar kullanılabilir tahmin sonuç kartı (Ders + Konu)
 */

import type { PredictionItem } from '../types/prediction';
import { formatConfidence, getSubjectName } from '../utils/predictionUtils';

interface PredictionResultsProps {
  subject: PredictionItem[];
  topic: PredictionItem[];
  showSubjectName?: boolean;
}

function PredictionRow({ item, showName = true }: { item: PredictionItem; showName?: boolean }) {
  const label = showName ? getSubjectName(item.label) : item.label;
  return (
    <div className="d-flex align-items-center gap-3 mb-2">
      <span className="fw-medium" style={{ minWidth: 200 }}>
        {label}
      </span>
      <div className="flex-grow-1">
        <div className="progress" style={{ height: 6 }}>
          <div
            className="progress-bar bg-primary"
            role="progressbar"
            style={{ width: `${item.confidence * 100}%` }}
            aria-valuenow={item.confidence * 100}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
      <span className="text-primary fw-semibold" style={{ minWidth: 52 }}>
        {formatConfidence(item.confidence)}
      </span>
    </div>
  );
}

export function PredictionResults({
  subject,
  topic,
  showSubjectName = true,
}: PredictionResultsProps) {
  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h6 className="text-uppercase text-muted small fw-semibold mb-3">Ders</h6>
        {subject.map((item, index) => (
          <PredictionRow key={index} item={item} showName={showSubjectName} />
        ))}
      </div>
      <div className="col-md-6">
        <h6 className="text-uppercase text-muted small fw-semibold mb-3">Konu</h6>
        {topic.map((item, index) => (
          <PredictionRow key={index} item={item} showName={false} />
        ))}
      </div>
    </div>
  );
}
