/**
 * Oluşturulan Sınavlar sayfası - hazırlanan sınavların listesi
 */

import { Card, Table, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTeacherData } from '../contexts/TeacherDataContext';

export function CreatedExams() {
  const { exams, analyses } = useTeacherData();

  const getAnalysisByExamId = (analysisId: string) =>
    analyses.find((a) => a.id === analysisId);

  const sortedExams = [...exams].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Oluşturulan Sınavlar</h4>
        <p className="text-muted mb-0">
          Hazırlanan ve öğrenci uygulamasında kullanılabilir sınavlar.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Tarih</th>
                <th>Başlık</th>
                <th>Hafta</th>
                <th>Soru</th>
                <th>Durum</th>
                <th className="text-end">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {sortedExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    <i className="bi bi-file-earmark-text fs-1 d-block mb-2" />
                    Henüz sınav oluşturulmamış
                    <p className="small mb-0 mt-2">
                      <Link to="/dashboard/sinav-analizi">PDF Sınav Analizi</Link> veya{' '}
                      <Link to="/dashboard/analiz-gecmisi">Analiz Geçmişi</Link> üzerinden sınav
                      oluşturabilirsiniz.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedExams.map((exam) => {
                  const analysis = getAnalysisByExamId(exam.analysisId);
                  const questionCount = Array.isArray(exam.selectedResults)
                    ? exam.selectedResults.length
                    : analysis?.analyzedQuestions ?? 0;
                  return (
                    <tr key={exam.id}>
                      <td className="small">
                        {new Date(exam.createdAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="fw-medium">{exam.title}</td>
                      <td>{exam.weekLabel}</td>
                      <td>{questionCount} soru</td>
                      <td>
                        <Badge bg={exam.status === 'ready' ? 'success' : 'warning'}>
                          {exam.status === 'ready' ? 'Hazır' : 'Taslak'}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="primary"
                          size="sm"
                          className="me-1"
                          as={Link}
                          to={`/dashboard/analiz-gecmisi/${exam.analysisId}`}
                        >
                          <i className="bi bi-pencil me-1" />
                          Düzenle
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          as={Link}
                          to={`/dashboard/analiz-gecmisi/${exam.analysisId}`}
                          aria-label="Görüntüle"
                        >
                          <i className="bi bi-eye" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
}
