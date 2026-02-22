namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Öğrenci-Veli ilişki tablosu - Bir veli birden fazla öğrenciyi takip edebilir.
/// </summary>
public class StudentParent
{
    public Guid StudentId { get; set; }
    public Guid ParentId { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual Student Student { get; set; } = null!;
    public virtual Parent Parent { get; set; } = null!;
}
