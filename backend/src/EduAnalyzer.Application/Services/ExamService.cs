using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Domain.ValueObjects;

namespace EduAnalyzer.Application.Services;

public interface IExamService
{
    Task<ExamDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<ExamDto?> GetByAnalysisIdAsync(Guid analysisId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamDto>> GetExamsAvailableForStudentAsync(Guid studentId, CancellationToken ct = default);
    Task<ExamDto?> UpdateAnswerKeyAsync(Guid examId, Guid teacherId, IReadOnlyList<string> answerKey, CancellationToken ct = default);
    Task<ScanExamResponse> ScanAndSaveResultAsync(Guid examId, Guid teacherId, ScanExamRequest request, CancellationToken ct = default);
    Task<ScanExamResponse> SubmitScanForStudentAsync(
        Guid examId,
        Guid studentId,
        Stream imageStream,
        int? questionCount,
        int? optionCount,
        string? imageContentType = null,
        string? opticalTemplate = null,
        CancellationToken ct = default);
    Task<ExamResultDto> AddExamResultAsync(Guid teacherId, CreateExamResultRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentAsync(Guid studentId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentForSelfAsync(Guid studentId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentWithResultsDto>> GetStudentsWithResultsForParentAsync(Guid parentId, CancellationToken ct = default);
    Task DeleteExamResultAsync(Guid resultId, Guid teacherId, CancellationToken ct = default);
    Task DeleteExamResultForStudentSelfAsync(Guid resultId, Guid studentId, CancellationToken ct = default);
    Task<ExamResultDto> UpdateExamResultAsync(Guid resultId, Guid teacherId, UpdateExamResultRequest request, CancellationToken ct = default);
    Task DeleteExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default);
}

public class ExamService : IExamService
{
    private static readonly JsonSerializerOptions JsonStoreOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IExamRepository _examRepo;
    private readonly IExamResultRepository _resultRepo;
    private readonly IStudentRepository _studentRepo;
    private readonly IMlServiceClient _mlClient;

    public ExamService(
        IExamRepository examRepo,
        IExamResultRepository resultRepo,
        IStudentRepository studentRepo,
        IMlServiceClient mlClient)
    {
        _examRepo = examRepo;
        _resultRepo = resultRepo;
        _studentRepo = studentRepo;
        _mlClient = mlClient;
    }

    public async Task<ExamDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var e = await _examRepo.GetByIdAsync(id, ct);
        if (e == null || e.TeacherId != teacherId) return null;
        return MapToDto(e);
    }

    public async Task<ExamDto?> GetByAnalysisIdAsync(Guid analysisId, Guid teacherId, CancellationToken ct = default)
    {
        var e = await _examRepo.GetByAnalysisIdAsync(analysisId, ct);
        if (e == null || e.TeacherId != teacherId) return null;
        return MapToDto(e);
    }

    public async Task<IReadOnlyList<ExamDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _examRepo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<ExamDto>> GetExamsAvailableForStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null) return [];

        var exams = await _examRepo.GetByTeacherIdAsync(student.TeacherId, ct);
        var results = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        var submittedExamIds = results.Select(r => r.ExamId).ToHashSet();

        return exams
            .Where(e =>
                e.Status == ExamStatus.Ready &&
                !submittedExamIds.Contains(e.Id) &&
                (e.Analysis.ClassId == null || e.Analysis.ClassId == student.ClassId))
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ExamResultDto> AddExamResultAsync(Guid teacherId, CreateExamResultRequest request, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(request.ExamId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Sınav bulunamadı veya yetkiniz yok.");

        var student = await _studentRepo.GetByIdAsync(request.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        var wrongTopicsJson = JsonSerializer.Serialize(request.WrongTopics.Select(w => new { w.Topic, w.Count }));
        var entity = new ExamResult
        {
            Id = Guid.NewGuid(),
            StudentId = request.StudentId,
            ExamId = request.ExamId,
            CorrectCount = request.CorrectCount,
            WrongCount = request.WrongCount,
            WrongTopicsJson = wrongTopicsJson,
            WrongQuestionsJson = "[]",
            CorrectQuestionsJson = "[]",
            Source = request.Source ?? "manual",
            CreatedAt = DateTime.UtcNow
        };
        var added = await _resultRepo.AddAsync(entity, ct);
        return MapResultToDto(added, student, exam);
    }

    public async Task DeleteExamResultAsync(Guid resultId, Guid teacherId, CancellationToken ct = default)
    {
        var entity = await _resultRepo.GetByIdAsync(resultId, ct);
        if (entity == null)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");

        var exam = await _examRepo.GetByIdAsync(entity.ExamId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Bu sonucu silme yetkiniz yok.");

        var deleted = await _resultRepo.DeleteAsync(resultId, ct);
        if (!deleted)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");
    }

    public async Task DeleteExamResultForStudentSelfAsync(Guid resultId, Guid studentId, CancellationToken ct = default)
    {
        var entity = await _resultRepo.GetByIdAsync(resultId, ct);
        if (entity == null)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");
        if (entity.StudentId != studentId)
            throw new UnauthorizedAccessException("Bu sonuca erişim yetkiniz yok.");

        var deleted = await _resultRepo.DeleteAsync(resultId, ct);
        if (!deleted)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");
    }

    public async Task DeleteExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null)
            throw new KeyNotFoundException("Sınav bulunamadı.");
        if (exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Bu sınavı silme yetkiniz yok.");

        await _resultRepo.DeleteByExamIdAsync(examId, ct);
        var deleted = await _examRepo.DeleteAsync(examId, ct);
        if (!deleted)
            throw new KeyNotFoundException("Sınav silinemedi.");
    }

    public async Task<ExamResultDto> UpdateExamResultAsync(
        Guid resultId,
        Guid teacherId,
        UpdateExamResultRequest request,
        CancellationToken ct = default)
    {
        if (request.CorrectCount < 0 || request.WrongCount < 0)
            throw new ArgumentException("Doğru ve yanlış sayıları negatif olamaz.");

        var entity = await _resultRepo.GetByIdAsync(resultId, ct);
        if (entity == null)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");

        var exam = await _examRepo.GetByIdAsync(entity.ExamId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Bu sonucu güncelleme yetkiniz yok.");

        var student = await _studentRepo.GetByIdAsync(entity.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        var topics = request.WrongTopics ?? [];
        entity.CorrectCount = request.CorrectCount;
        entity.WrongCount = request.WrongCount;
        entity.WrongTopicsJson = JsonSerializer.Serialize(topics.Select(w => new { w.Topic, w.Count }));
        entity.WrongQuestionsJson = "[]";
        entity.CorrectQuestionsJson = "[]";
        entity.Source = "manual";
        await _resultRepo.UpdateAsync(entity, ct);

        return MapResultToDto(entity, student, exam);
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentAsync(Guid studentId, Guid teacherId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null || student.TeacherId != teacherId) return [];
        var list = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        return list.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId) return [];
        var list = await _resultRepo.GetByExamIdAsync(examId, ct);
        return list.Select(r => MapResultToDto(r, r.Student, exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _resultRepo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(r => MapResultToDto(r, r.Student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentForSelfAsync(Guid studentId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null) return [];
        var list = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        return list.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<StudentWithResultsDto>> GetStudentsWithResultsForParentAsync(Guid parentId, CancellationToken ct = default)
    {
        var students = await _studentRepo.GetByParentIdAsync(parentId, ct);
        var result = new List<StudentWithResultsDto>();
        foreach (var student in students)
        {
            var results = await _resultRepo.GetByStudentIdAsync(student.Id, ct);
            var dtos = results.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
            result.Add(new StudentWithResultsDto(StudentService.MapToDto(student), dtos));
        }
        return result;
    }

    public async Task<ExamDto?> UpdateAnswerKeyAsync(Guid examId, Guid teacherId, IReadOnlyList<string> answerKey, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId) return null;

        var validAnswers = new[] { "A", "B", "C", "D" };
        var normalized = answerKey
            .Select(a =>
            {
                var s = (a?.Trim().ToUpperInvariant() ?? "");
                var c = s.Length > 0 ? s[0].ToString() : "";
                return validAnswers.Contains(c) ? c : "";
            })
            .ToList();

        exam.AnswerKeyJson = JsonSerializer.Serialize(normalized);
        await _examRepo.UpdateAsync(exam, ct);
        return MapToDto(exam);
    }

    public async Task<ScanExamResponse> ScanAndSaveResultAsync(Guid examId, Guid teacherId, ScanExamRequest request, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Sınav bulunamadı veya yetkiniz yok.");

        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        if (answerKey.Count == 0)
            throw new InvalidOperationException("Bu sınav için cevap anahtarı tanımlanmamış.");

        var student = await _studentRepo.GetByIdAsync(request.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        List<QuestionAnalysisResultDto> results;
        if (!string.IsNullOrEmpty(exam.SelectedResultsJson))
        {
            results = JsonSerializer.Deserialize<List<QuestionAnalysisResultDto>>(exam.SelectedResultsJson) ?? new List<QuestionAnalysisResultDto>();
        }
        else
        {
            var analysis = exam.Analysis;
            var pdfResponse = JsonSerializer.Deserialize<PdfAnalysisResponseDto>(analysis.ResultsJson);
            results = (pdfResponse?.Results ?? new List<QuestionAnalysisResultDto>()).ToList();
        }

        var wrongQuestions = new List<WrongQuestionDto>();
        var correctQuestions = new List<WrongQuestionDto>();
        var topicCounts = new Dictionary<string, int>();
        var correctCount = 0;
        var wrongCount = 0;

        for (var i = 0; i < Math.Max(answerKey.Count, request.StudentAnswers.Count); i++)
        {
            var correctAnswer = i < answerKey.Count ? (answerKey[i]?.Trim().ToUpperInvariant() ?? "") : "";
            var studentAnswer = i < request.StudentAnswers.Count ? (request.StudentAnswers[i]?.Trim().ToUpperInvariant() ?? "") : "";
            var studentChar = studentAnswer.Length > 0 ? studentAnswer[0].ToString() : "";

            if (string.IsNullOrEmpty(correctAnswer))
            {
                // Anahtarda bu soru boşsa önceden tamamen atlanıyordu; 19. soru gibi kayıplara yol açıyordu.
                if (string.IsNullOrEmpty(studentChar))
                    continue;
                wrongCount++;
                var rawTopicEmptyKey = i < results.Count && results[i].Topic.Count > 0
                    ? results[i].Topic[0].Label
                    : null;
                var topicEmptyKey = string.IsNullOrWhiteSpace(rawTopicEmptyKey) ? "Bilinmiyor" : rawTopicEmptyKey!;
                wrongQuestions.Add(new WrongQuestionDto(i + 1, studentAnswer, topicEmptyKey));
                topicCounts[topicEmptyKey] = topicCounts.GetValueOrDefault(topicEmptyKey, 0) + 1;
                continue;
            }

            var isCorrect = string.Equals(correctAnswer, studentChar, StringComparison.OrdinalIgnoreCase);

            if (isCorrect)
            {
                correctCount++;
                var rawTopicOk = i < results.Count && results[i].Topic.Count > 0
                    ? results[i].Topic[0].Label
                    : null;
                var topicOk = string.IsNullOrWhiteSpace(rawTopicOk) ? "Bilinmiyor" : rawTopicOk!;
                correctQuestions.Add(new WrongQuestionDto(i + 1, studentChar, topicOk));
            }
            else
            {
                wrongCount++;
                var rawTopic = i < results.Count && results[i].Topic.Count > 0
                    ? results[i].Topic[0].Label
                    : null;
                var topic = string.IsNullOrWhiteSpace(rawTopic) ? "Bilinmiyor" : rawTopic!;
                wrongQuestions.Add(new WrongQuestionDto(i + 1, studentAnswer, topic, correctAnswer));
                topicCounts[topic] = topicCounts.GetValueOrDefault(topic, 0) + 1;
            }
        }

        var wrongTopics = topicCounts.Select(kv => new WrongTopicDto(kv.Key, kv.Value)).ToList();
        var wrongTopicsJson = JsonSerializer.Serialize(wrongTopics.Select(w => new { w.Topic, w.Count }));
        var wrongQuestionsJson = JsonSerializer.Serialize(wrongQuestions, JsonStoreOptions);
        var correctQuestionsJson = JsonSerializer.Serialize(correctQuestions, JsonStoreOptions);

        var entity = new ExamResult
        {
            Id = Guid.NewGuid(),
            StudentId = request.StudentId,
            ExamId = examId,
            CorrectCount = correctCount,
            WrongCount = wrongCount,
            WrongTopicsJson = wrongTopicsJson,
            WrongQuestionsJson = wrongQuestionsJson,
            CorrectQuestionsJson = correctQuestionsJson,
            Source = "optical",
            CreatedAt = DateTime.UtcNow
        };
        await _resultRepo.AddAsync(entity, ct);

        return new ScanExamResponse(
            correctCount,
            wrongCount,
            answerKey.Count,
            correctQuestions,
            wrongQuestions,
            wrongTopics
        );
    }

    public async Task<ScanExamResponse> SubmitScanForStudentAsync(
        Guid examId,
        Guid studentId,
        Stream imageStream,
        int? questionCount,
        int? optionCount,
        string? imageContentType = null,
        string? opticalTemplate = null,
        CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct)
            ?? throw new UnauthorizedAccessException("Öğrenci bulunamadı.");

        var exam = await _examRepo.GetByIdAsync(examId, ct)
            ?? throw new KeyNotFoundException("Sınav bulunamadı.");

        if (exam.TeacherId != student.TeacherId)
            throw new UnauthorizedAccessException("Bu sınava erişim yetkiniz yok.");

        if (exam.Status != ExamStatus.Ready)
            throw new InvalidOperationException("Bu sınav henüz cevap gönderimine açık değil.");

        if (exam.Analysis.ClassId != null && exam.Analysis.ClassId != student.ClassId)
            throw new UnauthorizedAccessException("Bu sınav sizin sınıfınıza ait değil.");

        var existingResults = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        if (existingResults.Any(r => r.ExamId == examId))
            throw new InvalidOperationException("Bu sınav için sonucunuz zaten kaydedilmiş.");

        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        var count = questionCount ?? answerKey.Count;
        if (count <= 0)
            count = 20;

        var ocrResult = await _mlClient.ScanOpticalFormAsync(
            imageStream,
            count,
            optionCount,
            imageContentType,
            opticalTemplate,
            ct);
        return await ScanAndSaveResultAsync(
            examId,
            exam.TeacherId,
            new ScanExamRequest(studentId, ocrResult.Answers),
            ct
        );
    }

    private static ExamDto MapToDto(Exam e)
    {
        var answerKey = string.IsNullOrEmpty(e.AnswerKeyJson)
            ? null
            : JsonSerializer.Deserialize<List<string>>(e.AnswerKeyJson) as IReadOnlyList<string>;
        var selectedResults = string.IsNullOrEmpty(e.SelectedResultsJson)
            ? null
            : JsonSerializer.Deserialize<List<QuestionAnalysisResultDto>>(e.SelectedResultsJson) as IReadOnlyList<QuestionAnalysisResultDto>;
        return new ExamDto(
            e.Id,
            e.AnalysisId,
            e.Title,
            e.WeekLabel,
            e.Date,
            e.Status.ToString().ToLowerInvariant(),
            answerKey,
            selectedResults,
            e.CreatedAt
        );
    }

    private static ExamResultDto MapResultToDto(ExamResult r, Student s, Exam e)
    {
        var topics = (JsonSerializer.Deserialize<List<WrongTopicDto>>(r.WrongTopicsJson)
                ?? new List<WrongTopicDto>())
            .Select(t => new WrongTopicDto(
                string.IsNullOrWhiteSpace(t.Topic) ? "Bilinmiyor" : t.Topic,
                t.Count))
            .ToList();
        var wrongQuestions = string.IsNullOrEmpty(r.WrongQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(r.WrongQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();
        var correctQuestions = string.IsNullOrEmpty(r.CorrectQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(r.CorrectQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();
        return new ExamResultDto(
            r.Id,
            r.StudentId,
            $"{s.FirstName} {s.LastName}",
            s.StudentNo,
            r.ExamId,
            e.Title,
            r.CorrectCount,
            r.WrongCount,
            topics,
            correctQuestions,
            wrongQuestions,
            r.Source,
            r.CreatedAt
        );
    }
}
