/**
 * Öğrenci takibi - liste, arama, filtreleme
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Form, Button, Card, Badge, InputGroup, Modal } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';
import type { ApiError } from '../services/apiClient';

export function StudentTracking() {
  const { students, classes, getClassById, addStudent, deleteStudent } = useTeacherData();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentNo: '',
    firstName: '',
    lastName: '',
    classId: null as string | null,
    email: '',
    initialPassword: '',
  });

  const filteredStudents = useMemo(() => {
    let result = students;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.studentNo.includes(q) ||
          (s.email?.toLowerCase().includes(q) ?? false)
      );
    }
    if (classFilter) {
      result = result.filter((s) => s.classId === classFilter);
    }
    return result.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [students, search, classFilter]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.firstName.trim() || !newStudent.lastName.trim() || !newStudent.studentNo.trim())
      return;
    try {
      const pwd = newStudent.initialPassword.trim();
      if (pwd && !newStudent.email.trim()) {
        showToast('Mobil giriş için e-posta zorunludur.', 'danger');
        return;
      }
      await addStudent({
        studentNo: newStudent.studentNo.trim(),
        firstName: newStudent.firstName.trim(),
        lastName: newStudent.lastName.trim(),
        classId: newStudent.classId || null,
        email: newStudent.email.trim() || undefined,
        initialPassword: pwd || undefined,
      });
      setNewStudent({
        studentNo: '',
        firstName: '',
        lastName: '',
        classId: null,
        email: '',
        initialPassword: '',
      });
      setShowAddModal(false);
      showToast('Öğrenci başarıyla eklendi.');
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as ApiError).message)
          : 'Öğrenci eklenirken bir hata oluştu.';
      showToast(msg, 'danger');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`"${name}" öğrencisini silmek istediğinize emin misiniz?`)) {
      try {
        await deleteStudent(id);
        showToast('Öğrenci silindi.');
      } catch {
        showToast('Öğrenci silinirken bir hata oluştu.', 'danger');
      }
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Öğrenci Takibi</h4>
          <p className="text-muted mb-0">Öğrencilerinizi listeleyin, arayın ve takip edin.</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <i className="bi bi-person-plus me-2" />
          Yeni Öğrenci
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-3">
          <div className="row g-3">
            <div className="col-md-6">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search" aria-hidden />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Ad, soyad veya numara ile ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Öğrenci ara"
                />
              </InputGroup>
            </div>
            <div className="col-md-4">
              <Form.Select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Sınıf filtresi"
              >
                <option value="">Tüm sınıflar</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.grade}. sınıf)
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>No</th>
                <th>Ad Soyad</th>
                <th>Sınıf</th>
                <th>E-posta</th>
                <th>Mobil</th>
                <th className="text-end">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    <i className="bi bi-person-x fs-1 d-block mb-2" />
                    Öğrenci bulunamadı
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const cls = s.classId ? getClassById(s.classId) : null;
                  return (
                    <tr key={s.id}>
                      <td className="fw-medium">{s.studentNo}</td>
                      <td>
                        <Link
                          to={`/dashboard/ogrenci/${s.id}`}
                          className="text-decoration-none text-dark fw-medium"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td>
                        {cls ? (
                          <Badge bg="primary" className="fw-normal">
                            {cls.name}
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="small">{s.email || '—'}</td>
                      <td>
                        {s.hasAppAccount ? (
                          <Badge bg="success" className="fw-normal">
                            Aktif
                          </Badge>
                        ) : s.email?.trim() ? (
                          <Badge bg="warning" text="dark" className="fw-normal">
                            Şifre gerekli
                          </Badge>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <Link to={`/dashboard/ogrenci/${s.id}`}>
                          <Button variant="outline-primary" size="sm" className="me-1">
                            <i className="bi bi-eye" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)}
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

      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Yeni Öğrenci</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddStudent}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Öğrenci No</Form.Label>
              <Form.Control
                value={newStudent.studentNo}
                onChange={(e) => setNewStudent((p) => ({ ...p, studentNo: e.target.value }))}
                placeholder="1001"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ad</Form.Label>
              <Form.Control
                value={newStudent.firstName}
                onChange={(e) => setNewStudent((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="Ahmet"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Soyad</Form.Label>
              <Form.Control
                value={newStudent.lastName}
                onChange={(e) => setNewStudent((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Yılmaz"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Sınıf</Form.Label>
              <Form.Select
                value={newStudent.classId ?? ''}
                onChange={(e) => setNewStudent((p) => ({ ...p, classId: e.target.value || null }))}
              >
                <option value="">Sınıf seçin</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>E-posta</Form.Label>
              <Form.Control
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent((p) => ({ ...p, email: e.target.value }))}
                placeholder="ornek@email.com"
                autoComplete="off"
              />
              <Form.Text className="text-muted">
                Mobil uygulamada giriş için e-posta ve aşağıdaki şifreyi birlikte kullanın.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mobil uygulama şifresi</Form.Label>
              <Form.Control
                type="password"
                value={newStudent.initialPassword}
                onChange={(e) => setNewStudent((p) => ({ ...p, initialPassword: e.target.value }))}
                placeholder="En az 6 karakter (isteğe bağlı)"
                autoComplete="new-password"
                aria-label="Mobil uygulama şifresi"
              />
              <Form.Text className="text-muted">Boş bırakılırsa yalnızca kayıt oluşturulur; şifreyi sonra ekleyebilirsiniz.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              Kaydet
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
