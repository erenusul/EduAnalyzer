namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Kullanıcı entity - Öğretmen, öğrenci ve veli rolleri için temel kullanıcı bilgisi.
/// </summary>
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual Teacher? Teacher { get; set; }
    public virtual Student? Student { get; set; }
    public virtual Parent? Parent { get; set; }
}
