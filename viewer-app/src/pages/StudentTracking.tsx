/**
 * Öğrenci takibi - liste, arama, filtreleme
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Form, Button, Card, Badge, InputGroup, Modal } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';

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
      await addStudent({
        ...newStudent,
        classId: newStudent.classId || null,
      });
      setNewStudent({ studentNo: '', firstName: '', lastName: '', classId: null, email: '' });
      setShowAddModal(false);
      showToast('Öğrenci başarıyla eklendi.');
    } catch {
      showToast('Öğrenci eklenirken bir hata oluştu.', 'danger');
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
                <th className="text-end">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
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
              />
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
