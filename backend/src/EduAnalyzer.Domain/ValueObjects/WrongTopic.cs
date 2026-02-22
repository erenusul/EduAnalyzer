namespace EduAnalyzer.Domain.ValueObjects;

/// <summary>
/// Konu bazlı yanlış sayısı - ExamResult içinde JSON olarak saklanır.
/// </summary>
public record WrongTopic(string Topic, int Count);
