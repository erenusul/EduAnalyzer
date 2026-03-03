/**
 * Öğretmen düzeltmesi için düzenlenebilir ders/konu bileşeni
 * LLM yanlış tahmin verdiğinde öğretmen etiketi değiştirebilir
 */

import { useState } from 'react';
import { Form } from 'react-bootstrap';
import type { PredictionItem } from '../types/prediction';
import { getSubjectDisplayName, getTopicsForSubject, SUBJECT_CODES } from '../config/mlTopics';
import type { SubjectCode } from '../config/constants';
import { formatConfidence } from '../utils/predictionUtils';

interface EditablePredictionResultsProps {
  subject: PredictionItem[];
  topic: PredictionItem[];
  onUpdate?: (subjectCode: string, topicLabel: string, secondTopicLabel?: string) => void;
  disabled?: boolean;
}

export function EditablePredictionResults({
  subject,
  topic,
  onUpdate,
  disabled = false,
}: EditablePredictionResultsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTopicIndex, setEditingTopicIndex] = useState<0 | 1 | null>(null);

  const subjectCode = subject[0]?.label ?? 'turkce';
  const topicLabel = topic[0]?.label ?? '';
  const topicLabel2 = topic[1]?.label ?? '';
  const topics = getTopicsForSubject(subjectCode as SubjectCode);
  const isValidTopic = topics.includes(topicLabel);
  const isValidTopic2 = topics.includes(topicLabel2);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSubject = e.target.value as SubjectCode;
    const newTopics = getTopicsForSubject(newSubject);
    const newTopic = newTopics.includes(topicLabel) ? topicLabel : (newTopics[0] ?? '');
    const newTopic2 = topicLabel2 && newTopics.includes(topicLabel2) ? topicLabel2 : '';
    onUpdate?.(newSubject, newTopic, newTopic2 || undefined);
  };

  const handleTopicChange = (index: 0 | 1) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (index === 0) {
      onUpdate?.(subjectCode, value, topicLabel2 || undefined);
    } else {
      onUpdate?.(subjectCode, topicLabel, value || undefined);
    }
    setEditingTopicIndex(null);
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
        <div className="d-flex flex-column gap-2">
          {/* 1. tahmin */}
          {editingTopicIndex === 0 && canEdit ? (
            <Form.Select
              size="sm"
              value={isValidTopic ? topicLabel : ''}
              onChange={handleTopicChange(0)}
              onBlur={() => setEditingTopicIndex(null)}
              aria-label="1. tahmin konu seçin"
              autoFocus
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
              <span className="fw-medium">
                {topicLabel
                  ? `${formatConfidence(topic[0]?.confidence ?? 0)} ${topicLabel}`
                  : '—'}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-primary"
                  onClick={() => setEditingTopicIndex(0)}
                  aria-label="1. tahmin düzenle"
                >
                  <i className="bi bi-pencil" />
                </button>
              )}
            </div>
          )}
          {/* 2. tahmin */}
          {editingTopicIndex === 1 && canEdit ? (
            <Form.Select
              size="sm"
              value={isValidTopic2 ? topicLabel2 : ''}
              onChange={handleTopicChange(1)}
              onBlur={() => setEditingTopicIndex(null)}
              aria-label="2. tahmin konu seçin"
              autoFocus
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
              <span className="fw-medium">
                {topicLabel2
                  ? `${formatConfidence(topic[1]?.confidence ?? 0)} ${topicLabel2}`
                  : '—'}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-primary"
                  onClick={() => setEditingTopicIndex(1)}
                  aria-label="2. tahmin düzenle"
                >
                  <i className="bi bi-pencil" />
                </button>
              )}
            </div>
          )}
        </div>
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
