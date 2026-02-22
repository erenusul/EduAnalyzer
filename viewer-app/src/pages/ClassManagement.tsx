/**
 * Sınıf yönetimi sayfası
 */

import { useState } from 'react';
import { Card, Form, Button, Badge, Modal } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';

export function ClassManagement() {
  const { classes, getStudentsByClass, addClass, deleteClass } =
    useTeacherData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', grade: '8', academicYear: '2024-2025' });
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name.trim()) return;
    addClass(newClass);
    setNewClass({ name: '', grade: '8', academicYear: '2024-2025' });
    setShowAddModal(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`"${name}" sınıfını silmek istediğinize emin misiniz? Öğrenciler sınıfsız kalacaktır.`)) {
      deleteClass(id);
      setExpandedClassId(null);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Sınıf Yönetimi</h4>
          <p className="text-muted mb-0">
            Sınıflarınızı oluşturun ve öğrencileri atayın.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <i className="bi bi-plus-lg me-2" />
          Yeni Sınıf
        </Button>
      </div>

      <div className="row g-4">
        {classes.map((cls) => {
          const classStudents = getStudentsByClass(cls.id);
          const isExpanded = expandedClassId === cls.id;
          return (
            <div key={cls.id} className="col-md-6 col-lg-4">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h5 className="fw-bold mb-1">{cls.name}</h5>
                      <p className="text-muted small mb-0">
                        {cls.grade}. sınıf · {cls.academicYear}
                      </p>
                    </div>
                    <Badge bg="primary">{classStudents.length} öğrenci</Badge>
                  </div>
                  <div className="d-flex gap-1 mb-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() =>
                        setExpandedClassId(isExpanded ? null : cls.id)
                      }
                    >
                      <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-1`} />
                      {isExpanded ? 'Gizle' : 'Öğrenciler'}
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(cls.id, cls.name)}
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-top">
                      {classStudents.length === 0 ? (
                        <p className="text-muted small mb-0">Bu sınıfta öğrenci yok</p>
                      ) : (
                        <ul className="list-unstyled small mb-0">
                          {classStudents.map((s) => (
                            <li key={s.id} className="py-1">
                              {s.studentNo} - {s.firstName} {s.lastName}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          );
        })}
      </div>

      {classes.length === 0 && (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-collection fs-1 text-muted d-block mb-3" />
            <h5>Henüz sınıf yok</h5>
            <p className="text-muted mb-3">Yeni sınıf ekleyerek başlayın</p>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <i className="bi bi-plus-lg me-2" />
              Yeni Sınıf Ekle
            </Button>
          </Card.Body>
        </Card>
      )}

      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Yeni Sınıf</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddClass}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Sınıf Adı</Form.Label>
              <Form.Control
                value={newClass.name}
                onChange={(e) => setNewClass((p) => ({ ...p, name: e.target.value }))}
                placeholder="8-A"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Seviye</Form.Label>
              <Form.Select
                value={newClass.grade}
                onChange={(e) => setNewClass((p) => ({ ...p, grade: e.target.value }))}
              >
                {['5', '6', '7', '8'].map((g) => (
                  <option key={g} value={g}>
                    {g}. sınıf
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Eğitim Yılı</Form.Label>
              <Form.Control
                value={newClass.academicYear}
                onChange={(e) => setNewClass((p) => ({ ...p, academicYear: e.target.value }))}
                placeholder="2024-2025"
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
