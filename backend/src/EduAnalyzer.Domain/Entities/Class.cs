namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Sınıf entity - Öğretmenin yönettiği sınıf, öğrencileri gruplar.
/// </summary>
public class Class
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual Teacher Teacher { get; set; } = null!;
    public virtual ICollection<Student> Students { get; set; } = new List<Student>();
}
