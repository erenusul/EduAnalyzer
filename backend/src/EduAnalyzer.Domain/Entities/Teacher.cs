namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Öğretmen entity - User ile 1:1 ilişki, sınıfları yönetir.
/// </summary>
public class Teacher
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? SchoolName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
    public virtual ICollection<Class> Classes { get; set; } = new List<Class>();
    public virtual ICollection<AnalysisRecord> Analyses { get; set; } = new List<AnalysisRecord>();
}
