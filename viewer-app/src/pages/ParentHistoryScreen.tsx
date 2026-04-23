/**
 * Veli paneli — tüm çocukların sınav geçmişi (filtrelenebilir tablo)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Container, Form, Spinner, Alert, Table, Badge } from 'react-bootstrap';
import { meApi, mappers } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';
import type { ExamResult } from '../types/teacher';
import { lgsNet, sortResultsByDateDesc, successPct } from '../utils/parentResultUtils';

type Row = {
  key: string;
  studentId: string;
  studentName: string;
  result: ExamResult;
};

export function ParentHistoryScreen() {
  const [children, setChildren] = useState<StudentWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStudentId, setFilterStudentId] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    meApi
      .getMyChildren()
      .then((data) => {
        if (!cancelled) setChildren(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Veriler yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of children) {
      const name = `${c.student.firstName} ${c.student.lastName}`.trim();
      const sorted = sortResultsByDateDesc(c.results.map(mappers.toExamResult));
      for (const r of sorted) {
        out.push({
          key: `${c.student.id}-${r.id}`,
          studentId: c.student.id,
          studentName: name,
          result: r,
        });
      }
    }
    out.sort((a, b) => new Date(b.result.createdAt).getTime() - new Date(a.result.createdAt).getTime());
    return out;
  }, [children]);

  const filteredRows = useMemo(
    () => (filterStudentId === 'all' ? rows : rows.filter((x) => x.studentId === filterStudentId)),
    [rows, filterStudentId]
  );

  const totalExamCount = rows.length;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="border-0 shadow-sm">
        {error}
      </Alert>
    );
  }

  return (
    <Container fluid className="px-0">
      <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h3 className="fw-bold text-dark mb-2">Sınav geçmişi</h3>
          <p className="text-muted mb-0">
            Tüm sınav kayıtları tarihe göre listelenir. İsterseniz çocuğa göre filtreleyin.
          </p>
        </div>
        {children.length > 1 && totalExamCount > 0 && (
          <Form.Select
            className="border-0 shadow-sm"
            style={{ maxWidth: 280 }}
            value={filterStudentId}
            onChange={(e) => setFilterStudentId(e.target.value)}
            aria-label="Çocuğa göre filtrele"
          >
            <option value="all">Tüm çocuklar</option>
            {children.map((c) => (
              <option key={c.student.id} value={c.student.id}>
                {c.student.firstName} {c.student.lastName}
              </option>
            ))}
          </Form.Select>
        )}
      </div>

      {children.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-3 opacity-50" />
            Henüz bağlı öğrenciniz bulunmuyor.
          </Card.Body>
        </Card>
      ) : totalExamCount === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-journal-x fs-1 text-muted d-block mb-3" />
            <h5 className="fw-semibold text-dark">Henüz sınav verisi bulunmuyor</h5>
            <p className="text-muted mb-0 small">Kayıtlı sınav sonuçları burada listelenecek.</p>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <div className="px-4 py-3 border-bottom bg-white d-flex flex-wrap align-items-center gap-2">
              <Badge bg="light" text="dark" className="fw-normal border">
                {filteredRows.length} kayıt
                {filterStudentId !== 'all' && ` (filtreli)`}
              </Badge>
            </div>
            <Table responsive hover className="mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  {(filterStudentId === 'all' || children.length > 1) && (
                    <th className="ps-4">Öğrenci</th>
                  )}
                  <th className={filterStudentId !== 'all' && children.length === 1 ? 'ps-4' : ''}>Tarih</th>
                  <th>Sınav</th>
                  <th className="text-end">Doğru</th>
                  <th className="text-end">Yanlış</th>
                  <th className="text-end">Net</th>
                  <th className="text-end pe-4">Başarı</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ key, studentId, studentName, result: r }) => (
                  <tr key={key}>
                    {(filterStudentId === 'all' || children.length > 1) && (
                      <td className="ps-4">
                        <Link to={`/parent/student/${studentId}`} className="fw-medium text-decoration-none">
                          {studentName}
                        </Link>
                      </td>
                    )}
                    <td className={filterStudentId !== 'all' && children.length === 1 ? 'ps-4' : ''}>
                      {new Date(r.createdAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="fw-medium">{r.examTitle?.trim() || '—'}</td>
                    <td className="text-end text-success fw-semibold">{r.correctCount}</td>
                    <td className="text-end text-danger fw-semibold">{r.wrongCount}</td>
                    <td className="text-end fw-bold text-primary">{lgsNet(r)}</td>
                    <td className="text-end pe-4">{successPct(r)}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
