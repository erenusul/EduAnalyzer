namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Analiz kaydı - PDF veya tek soru analizi sonucu.
/// </summary>
public class AnalysisRecord
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public AnalysisType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? FileName { get; set; }
    public int TotalQuestions { get; set; }
    public int AnalyzedQuestions { get; set; }
    public string ResultsJson { get; set; } = "{}";
    public Guid? ClassId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual Teacher Teacher { get; set; } = null!;
    public virtual Exam? Exam { get; set; }
}
