/**
 * Oluşturulan Sınavlar sayfası - hazırlanan sınavların listesi
 */

import { useState } from 'react';
import { Card, Table, Button, Badge, Modal, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';
import { parseUtcToLocal } from '../utils/dateUtils';
import type { Exam } from '../types/teacher';

export function CreatedExams() {
  const { exams, analyses, students, refresh, loading, addExamResult, deleteExam, getResultsByExam } =
    useTeacherData();
  const { showToast } = useToast();
  const [addModalExam, setAddModalExam] = useState<Exam | null>(null);
  const [addStudentId, setAddStudentId] = useState('');
  const [addCorrect, setAddCorrect] = useState(0);
  const [addWrong, setAddWrong] = useState(0);
  const [addSaving, setAddSaving] = useState(false);
  const [deleteModalExam, setDeleteModalExam] = useState<Exam | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const getAnalysisByExamId = (analysisId: string) => analyses.find((a) => a.id === analysisId);

  const handleOpenAddResult = (exam: Exam) => {
    setAddModalExam(exam);
    setAddStudentId('');
    setAddCorrect(0);
    setAddWrong(0);
  };

  const handleCloseAddResult = () => {
    setAddModalExam(null);
    setAddStudentId('');
    setAddCorrect(0);
    setAddWrong(0);
  };

  const deleteResultCount = deleteModalExam ? getResultsByExam(deleteModalExam.id).length : 0;

  const handleConfirmDeleteExam = async () => {
    if (!deleteModalExam) return;
    setDeleteSaving(true);
    try {
      await deleteExam(deleteModalExam.id);
      showToast('Sınav kaldırıldı.');
      setDeleteModalExam(null);
    } catch {
      showToast('Sınav silinirken hata oluştu.', 'danger');
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleAddResult = async () => {
    if (!addModalExam || !addStudentId) {
      showToast('Öğrenci seçiniz.', 'warning');
      return;
    }
    setAddSaving(true);
    try {
      await addExamResult({
        studentId: addStudentId,
        examId: addModalExam.id,
        correctCount: addCorrect,
        wrongCount: addWrong,
        wrongTopics: [],
      });
      showToast('Sınav sonucu eklendi.');
      handleCloseAddResult();
    } catch {
      showToast('Sonuç eklenirken hata oluştu.', 'danger');
    } finally {
      setAddSaving(false);
    }
  };

  const sortedExams = [...exams].sort(
    (a, b) => parseUtcToLocal(b.createdAt).getTime() - parseUtcToLocal(a.createdAt).getTime()
  );

  return (
    <div>
      <div className="mb-4 d-flex justify-content-between align-items-start">
        <div>
          <h4 className="fw-bold mb-1">Oluşturulan Sınavlar</h4>
          <p className="text-muted mb-0">
            Hazırlanan ve öğrenci uygulamasında kullanılabilir sınavlar.
          </p>
        </div>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => refresh()}
          disabled={loading}
          aria-label="Sınav listesini yenile"
        >
          <i className="bi bi-arrow-clockwise me-1" aria-hidden />
          Yenile
        </Button>
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
                    : (analysis?.analyzedQuestions ?? 0);
                  return (
                    <tr key={exam.id}>
                      <td className="small">
                        {parseUtcToLocal(exam.createdAt).toLocaleDateString('tr-TR', {
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
                        <Link to={`/dashboard/analiz-gecmisi/${exam.analysisId}`}>
                          <Button variant="primary" size="sm" className="me-1">
                            <i className="bi bi-pencil me-1" />
                            Düzenle
                          </Button>
                        </Link>
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="me-1"
                          onClick={() => handleOpenAddResult(exam)}
                          aria-label="Sonuç ekle"
                        >
                          <i className="bi bi-plus-circle me-1" />
                          Sonuç Ekle
                        </Button>
                        <Link to={`/dashboard/analiz-gecmisi/${exam.analysisId}`}>
                          <Button variant="outline-primary" size="sm" className="me-1" aria-label="Görüntüle">
                            <i className="bi bi-eye" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => setDeleteModalExam(exam)}
                          aria-label="Sınavı kaldır"
                        >
                          <i className="bi bi-trash" />
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

      <Modal show={!!addModalExam} onHide={handleCloseAddResult} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manuel Sonuç Ekle</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addModalExam && (
            <p className="text-muted small mb-3">
              {addModalExam.title} ({addModalExam.weekLabel})
            </p>
          )}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="add-result-student">Öğrenci</Form.Label>
            <Form.Select
              id="add-result-student"
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              aria-label="Öğrenci seçin"
            >
              <option value="">Öğrenci seçin</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.studentNo})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="add-result-correct">Doğru Sayısı</Form.Label>
            <Form.Control
              id="add-result-correct"
              type="number"
              min={0}
              value={addCorrect}
              onChange={(e) => setAddCorrect(parseInt(e.target.value, 10) || 0)}
              aria-label="Doğru sayısı"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="add-result-wrong">Yanlış Sayısı</Form.Label>
            <Form.Control
              id="add-result-wrong"
              type="number"
              min={0}
              value={addWrong}
              onChange={(e) => setAddWrong(parseInt(e.target.value, 10) || 0)}
              aria-label="Yanlış sayısı"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseAddResult}>
            İptal
          </Button>
          <Button
            variant="primary"
            onClick={handleAddResult}
            disabled={addSaving || !addStudentId}
            aria-label="Sonucu kaydet"
          >
            {addSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                Kaydediliyor...
              </>
            ) : (
              'Kaydet'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!deleteModalExam} onHide={() => !deleteSaving && setDeleteModalExam(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Sınavı kaldır</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteModalExam && (
            <>
              <p className="mb-2">
                <strong>{deleteModalExam.title}</strong> sınavını listeden kaldırmak istediğinize emin misiniz?
              </p>
              <p className="text-muted small mb-0">
                Bu sınavın bağlı olduğu analiz kaydı silinmez; yalnızca sınav ve öğrenci sonuçları kaldırılır.
                {deleteResultCount > 0 && (
                  <>
                    {' '}
                    <span className="text-danger fw-semibold">
                      {deleteResultCount} öğrenci sonucu da silinecek.
                    </span>
                  </>
                )}
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteModalExam(null)} disabled={deleteSaving}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteExam} disabled={deleteSaving}>
            {deleteSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                Kaldırılıyor...
              </>
            ) : (
              'Evet, kaldır'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
