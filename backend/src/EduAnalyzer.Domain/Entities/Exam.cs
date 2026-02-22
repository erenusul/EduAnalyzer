namespace EduAnalyzer.Domain.Entities;

/// <summary>
/// Sınav entity - Analiz kaydından türetilir, haftalık deneme sınavı.
/// </summary>
public class Exam
{
    public Guid Id { get; set; }
    public Guid AnalysisId { get; set; }
    public Guid TeacherId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string WeekLabel { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public ExamStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual AnalysisRecord Analysis { get; set; } = null!;
    public virtual Teacher Teacher { get; set; } = null!;
    public virtual ICollection<ExamResult> ExamResults { get; set; } = new List<ExamResult>();
}
