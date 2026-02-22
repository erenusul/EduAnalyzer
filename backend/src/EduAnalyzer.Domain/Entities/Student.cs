namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Öğrenci entity - Sınıfa atanabilir, sınav sonuçlarına sahiptir.
/// </summary>
public class Student
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string StudentNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? ClassId { get; set; }
    public Guid TeacherId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual User? User { get; set; }
    public virtual Class? Class { get; set; }
    public virtual Teacher Teacher { get; set; } = null!;
    public virtual ICollection<ExamResult> ExamResults { get; set; } = new List<ExamResult>();
    public virtual ICollection<StudentParent> StudentParents { get; set; } = new List<StudentParent>();
}
