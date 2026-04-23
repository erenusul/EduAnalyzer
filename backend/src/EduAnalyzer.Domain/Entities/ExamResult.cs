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
    /// <summary>Doğru cevaplanan sorular (JSON, WrongQuestionDto ile aynı şema).</summary>
    public string CorrectQuestionsJson { get; set; } = "[]";
    /// <summary>Optik okumada öğretmen incelemesi önerilen sorular (SuspiciousQuestionHintDto JSON dizisi).</summary>
    public string SuspiciousQuestionsJson { get; set; } = "[]";
    /// <summary>Öğretmen şüpheli soru listesini onayladığında UTC zaman.</summary>
    public DateTime? SuspiciousReviewedAt { get; set; }
    public string? Source { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual Student Student { get; set; } = null!;
    public virtual Exam Exam { get; set; } = null!;
}
