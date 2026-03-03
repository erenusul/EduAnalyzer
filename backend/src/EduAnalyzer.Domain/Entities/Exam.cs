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
    /// <summary>
    /// Cevap anahtarı JSON - soru sırasına göre doğru cevaplar: ["A","B","C","D",...]
    /// </summary>
    public string? AnswerKeyJson { get; set; }
    /// <summary>
    /// Seçilen soruların analiz sonuçları JSON - QuestionAnalysisResultDto[].
    /// Boşsa tüm analiz kullanılır (geriye dönük uyumluluk).
    /// </summary>
    public string? SelectedResultsJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public virtual AnalysisRecord Analysis { get; set; } = null!;
    public virtual Teacher Teacher { get; set; } = null!;
    public virtual ICollection<ExamResult> ExamResults { get; set; } = new List<ExamResult>();
}
