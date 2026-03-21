/**
 * Cevap anahtarı düzenleyici - grid ve metin yapıştırma desteği
 */

import { useState, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';

const OPTIONS = ['A', 'B', 'C', 'D'] as const;

interface AnswerKeyEditorProps {
  questionCount: number;
  value: string[];
  onChange: (answerKey: string[]) => void;
  disabled?: boolean;
}

function parsePasteText(text: string): string[] {
  const chunks = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  return chunks.map((s) => (OPTIONS.includes(s[0] as (typeof OPTIONS)[number]) ? s[0] : ''));
}

export function AnswerKeyEditor({
  questionCount,
  value,
  onChange,
  disabled = false,
}: AnswerKeyEditorProps) {
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const currentAnswers = value.length === questionCount ? value : Array(questionCount).fill('');

  const handleSelectChange = useCallback(
    (index: number, option: string) => {
      const next = [...currentAnswers];
      next[index] = option;
      onChange(next);
    },
    [currentAnswers, onChange]
  );

  const handlePasteApply = useCallback(() => {
    const parsed = parsePasteText(pasteText);
    if (parsed.length !== questionCount) {
      setPasteError(`${parsed.length} cevap bulundu, ${questionCount} bekleniyor.`);
      return;
    }
    const invalid = parsed.filter((a) => !OPTIONS.includes(a as (typeof OPTIONS)[number]));
    if (invalid.length > 0) {
      setPasteError('Geçersiz karakter var. Sadece A, B, C, D kullanın.');
      return;
    }
    setPasteError(null);
    onChange(parsed);
  }, [pasteText, questionCount, onChange]);

  const handlePasteClear = useCallback(() => {
    setPasteText('');
    setPasteError(null);
  }, []);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <Form.Control
          as="textarea"
          rows={2}
          placeholder="A,B,C,D,A,B,C,... (virgül veya boşlukla ayırın)"
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPasteError(null);
          }}
          disabled={disabled}
          aria-label="Cevap anahtarı metin girişi"
          className="flex-grow-1"
          style={{ minWidth: 200, maxWidth: 400 }}
        />
        <div className="d-flex gap-1">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handlePasteApply}
            disabled={disabled}
          >
            Uygula
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handlePasteClear}
            disabled={disabled}
          >
            Temizle
          </Button>
        </div>
      </div>
      {pasteError && (
        <div className="text-danger small" role="alert">
          {pasteError}
        </div>
      )}
      <div className="d-flex flex-wrap gap-2 align-items-center">
        {Array.from({ length: questionCount }, (_, i) => (
          <div key={i} className="d-flex align-items-center gap-1">
            <span className="text-muted small" style={{ minWidth: 28 }}>
              {i + 1}.
            </span>
            <Form.Select
              size="sm"
              value={currentAnswers[i] || ''}
              onChange={(e) => handleSelectChange(i, e.target.value)}
              disabled={disabled}
              aria-label={`Soru ${i + 1} cevabı`}
              style={{ width: 56 }}
            >
              <option value="">—</option>
              {OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Form.Select>
          </div>
        ))}
      </div>
    </div>
  );
}
