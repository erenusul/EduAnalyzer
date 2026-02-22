namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Veli entity - User ile 1:1 ilişki, öğrencileri takip eder.
/// </summary>
public class Parent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? Phone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
    public virtual ICollection<StudentParent> StudentParents { get; set; } = new List<StudentParent>();
}
