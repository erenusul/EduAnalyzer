namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Sınav sonucu - Öğrencinin bir sınavdaki doğru/yanlış ve konu bazlı hataları.
/// Optik okuma veya manuel giriş ile oluşturulur.
/// </summary>
public class ExamResult
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public Guid ExamId { get; set; }
    public int CorrectCount { get; set; }
    public int WrongCount { get; set; }
    public string WrongTopicsJson { get; set; } = "[]";
    /// <summary>Soru bazlı yanlışlar (JSON). Optik/manuel taramada doldurulur.</summary>
    public string WrongQuestionsJson { get; set; } = "[]";
    public string? Source { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual Student Student { get; set; } = null!;
    public virtual Exam Exam { get; set; } = null!;
}
