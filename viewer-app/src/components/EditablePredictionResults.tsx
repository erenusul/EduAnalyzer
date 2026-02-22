/**
 * Öğretmen düzeltmesi için düzenlenebilir ders/konu bileşeni
 * LLM yanlış tahmin verdiğinde öğretmen etiketi değiştirebilir
 */

import { useState } from 'react';
import { Form } from 'react-bootstrap';
import type { PredictionItem } from '../types/prediction';
import { getSubjectDisplayName, getTopicsForSubject, SUBJECT_CODES } from '../config/mlTopics';
import type { SubjectCode } from '../config/constants';

interface EditablePredictionResultsProps {
  subject: PredictionItem[];
  topic: PredictionItem[];
  onUpdate?: (subjectCode: string, topicLabel: string) => void;
  disabled?: boolean;
}

export function EditablePredictionResults({
  subject,
  topic,
  onUpdate,
  disabled = false,
}: EditablePredictionResultsProps) {
  const [isEditing, setIsEditing] = useState(false);

  const subjectCode = subject[0]?.label ?? 'turkce';
  const topicLabel = topic[0]?.label ?? '';
  const topics = getTopicsForSubject(subjectCode as SubjectCode);
  const isValidTopic = topics.includes(topicLabel);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSubject = e.target.value as SubjectCode;
    const newTopics = getTopicsForSubject(newSubject);
    const newTopic = newTopics.includes(topicLabel) ? topicLabel : (newTopics[0] ?? '');
    onUpdate?.(newSubject, newTopic);
  };

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) onUpdate?.(subjectCode, value);
  };

  const canEdit = !disabled && !!onUpdate;

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h6 className="text-uppercase text-muted small fw-semibold mb-2">Ders</h6>
        {isEditing && canEdit ? (
          <Form.Select
            size="sm"
            value={subjectCode}
            onChange={handleSubjectChange}
            aria-label="Ders seçin"
          >
            {SUBJECT_CODES.map((code) => (
              <option key={code} value={code}>
                {getSubjectDisplayName(code)}
              </option>
            ))}
          </Form.Select>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <span className="fw-medium">{getSubjectDisplayName(subjectCode)}</span>
            {canEdit && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-primary"
                onClick={() => setIsEditing(true)}
                aria-label="Düzenle"
              >
                <i className="bi bi-pencil" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="col-md-6">
        <h6 className="text-uppercase text-muted small fw-semibold mb-2">Konu</h6>
        {isEditing && canEdit ? (
          <Form.Select
            size="sm"
            value={isValidTopic ? topicLabel : ''}
            onChange={handleTopicChange}
            aria-label="Konu seçin"
          >
            <option value="">Konu seçin...</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Form.Select>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <span className="fw-medium">{topicLabel || '—'}</span>
            {canEdit && !isEditing && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-primary"
                onClick={() => setIsEditing(true)}
                aria-label="Düzenle"
              >
                <i className="bi bi-pencil" />
              </button>
            )}
          </div>
        )}
      </div>
      {isEditing && canEdit && (
        <div className="col-12">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setIsEditing(false)}
          >
            Tamamla
          </button>
        </div>
      )}
    </div>
  );
}
