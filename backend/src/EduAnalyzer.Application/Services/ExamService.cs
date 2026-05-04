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
    Task<ExamDto?> PatchExamAsync(Guid examId, Guid teacherId, PatchExamRequest request, CancellationToken ct = default);
    Task<ExamDto?> UpdateAnswerKeyAsync(Guid examId, Guid teacherId, IReadOnlyList<string> answerKey, CancellationToken ct = default);
    Task<ScanExamResponse> ScanAndSaveResultAsync(
        Guid examId,
        Guid teacherId,
        ScanExamRequest request,
        IReadOnlyList<OpticalPerQuestionReadDto>? opticalPerQuestion = null,
        CancellationToken ct = default);
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
    Task<ScanExamResponse> ApplyOpticalReadingCorrectionsForStudentAsync(
        Guid examResultId,
        Guid studentId,
        ApplyOpticalReadingCorrectionsRequest request,
        CancellationToken ct = default);
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
        var entity = await _resultRepo.GetByIdAsync(resultId, ct);
        if (entity == null)
            throw new KeyNotFoundException("Sınav sonucu bulunamadı.");

        var exam = await _examRepo.GetByIdAsync(entity.ExamId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Bu sonucu güncelleme yetkiniz yok.");

        var student = await _studentRepo.GetByIdAsync(entity.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        if (request.AcknowledgeSuspiciousReview == true
            && request.CorrectCount == null
            && request.WrongCount == null)
        {
            entity.SuspiciousReviewedAt = DateTime.UtcNow;
            entity.UpdatedAt = DateTime.UtcNow;
            await _resultRepo.UpdateAsync(entity, ct);
            return MapResultToDto(entity, student, exam);
        }

        if (!request.CorrectCount.HasValue || !request.WrongCount.HasValue)
            throw new ArgumentException("Doğru ve yanlış sayıları gerekli.");

        if (request.CorrectCount.Value < 0 || request.WrongCount.Value < 0)
            throw new ArgumentException("Doğru ve yanlış sayıları negatif olamaz.");

        var topics = request.WrongTopics ?? [];
        entity.CorrectCount = request.CorrectCount.Value;
        entity.WrongCount = request.WrongCount.Value;
        entity.WrongTopicsJson = JsonSerializer.Serialize(topics.Select(w => new { w.Topic, w.Count }));
        entity.WrongQuestionsJson = "[]";
        entity.CorrectQuestionsJson = "[]";
        entity.SuspiciousQuestionsJson = "[]";
        entity.SuspiciousReviewedAt = null;
        entity.Source = "manual";
        entity.UpdatedAt = DateTime.UtcNow;
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

    public async Task<ExamDto?> PatchExamAsync(Guid examId, Guid teacherId, PatchExamRequest request, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId) return null;

        var changed = false;
        if (request.Title != null)
        {
            exam.Title = request.Title.Trim();
            changed = true;
        }

        if (request.WeekLabel != null)
        {
            exam.WeekLabel = request.WeekLabel.Trim();
            changed = true;
        }

        if (changed)
            await _examRepo.UpdateAsync(exam, ct);
        return MapToDto(exam);
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

    public async Task<ScanExamResponse> ScanAndSaveResultAsync(
        Guid examId,
        Guid teacherId,
        ScanExamRequest request,
        IReadOnlyList<OpticalPerQuestionReadDto>? opticalPerQuestion = null,
        CancellationToken ct = default)
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

        var grading = GradeStudentAnswersCore(exam, request.StudentAnswers);
        var correctCount = grading.CorrectQuestions.Count;
        var wrongCount = grading.WrongQuestions.Count;
        var correctQuestions = grading.CorrectQuestions;
        var wrongQuestions = grading.WrongQuestions;
        var wrongTopics = grading.WrongTopics;
        var wrongTopicsJson = JsonSerializer.Serialize(wrongTopics.Select(w => new { w.Topic, w.Count }));
        var wrongQuestionsJson = JsonSerializer.Serialize(wrongQuestions, JsonStoreOptions);
        var correctQuestionsJson = JsonSerializer.Serialize(correctQuestions, JsonStoreOptions);
        var suspicious = OcrSuspiciousQuestionMarker.Build(opticalPerQuestion);
        var suspiciousJson = JsonSerializer.Serialize(suspicious, JsonStoreOptions);

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
            SuspiciousQuestionsJson = suspiciousJson,
            SuspiciousReviewedAt = null,
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
            wrongTopics,
            suspicious,
            entity.Id
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
        OpticalScanStrictValidator.EnsureAcceptable(ocrResult);
        var gradedAnswers = OpticalReadGradingNormalizer.NormalizeAgainstAnswerKey(
            ocrResult.Answers,
            answerKey);
        return await ScanAndSaveResultAsync(
            examId,
            exam.TeacherId,
            new ScanExamRequest(studentId, gradedAnswers),
            ocrResult.PerQuestion,
            ct
        );
    }

    public async Task<ScanExamResponse> ApplyOpticalReadingCorrectionsForStudentAsync(
        Guid examResultId,
        Guid studentId,
        ApplyOpticalReadingCorrectionsRequest request,
        CancellationToken ct = default)
    {
        var entity = await _resultRepo.GetByIdAsync(examResultId, ct)
            ?? throw new KeyNotFoundException("Sınav sonucu bulunamadı.");

        if (entity.StudentId != studentId)
            throw new UnauthorizedAccessException("Bu sonuca erişim yetkiniz yok.");

        if (!string.Equals(entity.Source, "optical", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Yalnızca optik tarama sonuçları düzeltilebilir.");

        var exam = await _examRepo.GetByIdAsync(entity.ExamId, ct)
            ?? throw new KeyNotFoundException("Sınav bulunamadı.");

        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        if (answerKey.Count == 0)
            throw new InvalidOperationException("Bu sınav için cevap anahtarı tanımlanmamış.");

        if (request.Corrections is not { Count: > 0 })
            throw new ArgumentException("Düzeltme listesi boş olamaz.");

        var previousSuspicious = string.IsNullOrEmpty(entity.SuspiciousQuestionsJson)
            ? new List<SuspiciousQuestionHintDto>()
            : JsonSerializer.Deserialize<List<SuspiciousQuestionHintDto>>(entity.SuspiciousQuestionsJson, JsonStoreOptions) ?? new List<SuspiciousQuestionHintDto>();

        var belirsiz = previousSuspicious
            .Where(s => s.Reason == OcrSuspiciousQuestionMarker.BelirsizOrEmptyReason)
            .ToList();

        if (belirsiz.Count == 0)
            throw new InvalidOperationException("Belirsiz veya boş okuma maddesi yok; düzeltme gerekmez.");

        if (request.Corrections.Count != belirsiz.Count)
            throw new ArgumentException("Tüm belirsiz maddeler için cevap girişi gerekli.");

        var belirsizIndexSet = belirsiz.Select(s => s.QuestionIndex).ToHashSet();
        if (belirsizIndexSet.Count != belirsiz.Count)
            throw new InvalidOperationException("Belirsiz soru listesinde yinelenen numara var.");

        var byIndex = new Dictionary<int, string?>();
        foreach (var c in request.Corrections)
        {
            if (c.QuestionIndex < 1 || c.QuestionIndex > answerKey.Count)
                throw new ArgumentException("Geçersiz soru numarası.");
            if (!belirsizIndexSet.Contains(c.QuestionIndex))
                throw new ArgumentException("Bu soru manuel düzeltme kapsamında değil (yalnızca emin olunamayan veya boş okumalar).");
            if (byIndex.ContainsKey(c.QuestionIndex))
                throw new ArgumentException("Aynı soru iki kez gönderilemez.");
            byIndex[c.QuestionIndex] = c.Answer;
        }

        if (byIndex.Count != belirsiz.Count)
            throw new ArgumentException("Tüm belirsiz maddeler için cevap girişi gerekli.");

        var rawList = ReconstructStudentAnswersFromStoredResult(entity, answerKey.Count);
        var keyAllowsE = answerKey.Any(k => string.Equals(k?.Trim(), "E", StringComparison.OrdinalIgnoreCase));

        foreach (var kv in byIndex)
        {
            var qIndex = kv.Key;
            var answerRaw = kv.Value;
            var t = (answerRaw ?? "").Trim();
            if (t.Length == 0)
            {
                rawList[qIndex - 1] = "";
                continue;
            }

            if (t.Length > 1)
                throw new ArgumentException($"Soru {qIndex}: yalnızca tek harf (A–E) veya boş değer kabul edilir.");
            var ch = char.ToUpperInvariant(t[0]);
            if (ch is < 'A' or > 'E')
                throw new ArgumentException($"Soru {qIndex}: yalnızca A, B, C, D, E kabul edilir.");
            if (!keyAllowsE && ch == 'E')
                throw new ArgumentException("Bu sınav cevap anahtarı E şıkkını içermiyor; E seçilemez.");
            rawList[qIndex - 1] = ch.ToString();
        }

        var normalized = OpticalReadGradingNormalizer.NormalizeAgainstAnswerKey(rawList, answerKey);
        var grading = GradeStudentAnswersCore(exam, normalized);

        var newSuspicious = previousSuspicious
            .Where(s => s.Reason != OcrSuspiciousQuestionMarker.BelirsizOrEmptyReason)
            .ToList();

        var wrongTopicsJson = JsonSerializer.Serialize(grading.WrongTopics.Select(w => new { w.Topic, w.Count }));
        var wrongQuestionsJson = JsonSerializer.Serialize(grading.WrongQuestions, JsonStoreOptions);
        var correctQuestionsJson = JsonSerializer.Serialize(grading.CorrectQuestions, JsonStoreOptions);
        var suspiciousJson = JsonSerializer.Serialize(newSuspicious, JsonStoreOptions);

        entity.CorrectCount = grading.CorrectQuestions.Count;
        entity.WrongCount = grading.WrongQuestions.Count;
        entity.WrongTopicsJson = wrongTopicsJson;
        entity.WrongQuestionsJson = wrongQuestionsJson;
        entity.CorrectQuestionsJson = correctQuestionsJson;
        entity.SuspiciousQuestionsJson = suspiciousJson;
        entity.UpdatedAt = DateTime.UtcNow;
        await _resultRepo.UpdateAsync(entity, ct);

        return new ScanExamResponse(
            entity.CorrectCount,
            entity.WrongCount,
            answerKey.Count,
            grading.CorrectQuestions,
            grading.WrongQuestions,
            grading.WrongTopics,
            newSuspicious,
            entity.Id
        );
    }

    private static List<string> ReconstructStudentAnswersFromStoredResult(ExamResult entity, int slotCount)
    {
        if (slotCount <= 0)
            return new List<string>();

        var result = new string[slotCount];
        for (var i = 0; i < slotCount; i++)
            result[i] = "";

        var correct = string.IsNullOrEmpty(entity.CorrectQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(entity.CorrectQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();
        var wrong = string.IsNullOrEmpty(entity.WrongQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(entity.WrongQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();

        foreach (var c in correct)
        {
            if (c.QuestionIndex < 1 || c.QuestionIndex > slotCount) continue;
            result[c.QuestionIndex - 1] = c.StudentAnswer ?? "";
        }
        foreach (var w in wrong)
        {
            if (w.QuestionIndex < 1 || w.QuestionIndex > slotCount) continue;
            result[w.QuestionIndex - 1] = w.StudentAnswer ?? "";
        }
        return result.ToList();
    }

    private sealed record GradingOutcome(
        List<WrongQuestionDto> CorrectQuestions,
        List<WrongQuestionDto> WrongQuestions,
        List<WrongTopicDto> WrongTopics);

    private static GradingOutcome GradeStudentAnswersCore(Exam exam, IReadOnlyList<string> studentAnswers)
    {
        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        var selectedResults = DeserializeSelectedQuestionResults(exam.SelectedResultsJson);
        var fullPdfResults = DeserializePdfResultsFromAnalysis(exam.Analysis.ResultsJson);

        var wrongQuestions = new List<WrongQuestionDto>();
        var correctQuestions = new List<WrongQuestionDto>();

        for (var i = 0; i < Math.Max(answerKey.Count, studentAnswers.Count); i++)
        {
            var row = PickQuestionAnalysisRow(i, selectedResults, fullPdfResults);
            var topicLabel = ResolveTopicLabel(row, i + 1);

            var correctAnswer = i < answerKey.Count ? (answerKey[i]?.Trim().ToUpperInvariant() ?? "") : "";
            var studentAnswer = i < studentAnswers.Count ? (studentAnswers[i]?.Trim().ToUpperInvariant() ?? "") : "";
            var studentChar = studentAnswer.Length > 0 ? studentAnswer[0].ToString() : "";

            if (string.IsNullOrEmpty(correctAnswer))
            {
                if (string.IsNullOrEmpty(studentChar))
                    continue;
                wrongQuestions.Add(new WrongQuestionDto(i + 1, studentAnswer, topicLabel));
                continue;
            }

            var isCorrect = string.Equals(correctAnswer, studentChar, StringComparison.OrdinalIgnoreCase);

            if (isCorrect)
            {
                correctQuestions.Add(new WrongQuestionDto(i + 1, studentChar, topicLabel));
            }
            else
            {
                wrongQuestions.Add(new WrongQuestionDto(i + 1, studentAnswer, topicLabel, correctAnswer));
            }
        }

        var wrongTopics = BuildWrongTopicsFromWrongQuestions(wrongQuestions);
        return new GradingOutcome(correctQuestions, wrongQuestions, wrongTopics);
    }

    private static List<QuestionAnalysisResultDto> DeserializeSelectedQuestionResults(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];
        return JsonSerializer.Deserialize<List<QuestionAnalysisResultDto>>(json, JsonStoreOptions) ?? [];
    }

    private static List<QuestionAnalysisResultDto> DeserializePdfResultsFromAnalysis(string? resultsJson)
    {
        if (string.IsNullOrWhiteSpace(resultsJson))
            return [];
        try
        {
            var pdf = JsonSerializer.Deserialize<PdfAnalysisResponseDto>(resultsJson, JsonStoreOptions);
            return pdf?.Results?.ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// Sınav sorusu sırası: önce seçilen alt küme (varsa), yoksa tam PDF analiz listesi — böylece indeks
    /// taşması veya boş Topic dizisi yüzünden konu hep "Bilinmiyor" olmaz.
    /// </summary>
    private static QuestionAnalysisResultDto? PickQuestionAnalysisRow(
        int slotIndex,
        IReadOnlyList<QuestionAnalysisResultDto> selectedResults,
        IReadOnlyList<QuestionAnalysisResultDto> fullPdfResults)
    {
        if (selectedResults.Count > 0 && slotIndex < selectedResults.Count)
            return selectedResults[slotIndex];
        if (fullPdfResults.Count > 0 && slotIndex < fullPdfResults.Count)
            return fullPdfResults[slotIndex];
        return null;
    }

    private static string ResolveTopicLabel(QuestionAnalysisResultDto? row, int questionNumber1Based)
    {
        if (row != null)
        {
            foreach (var t in row.Topic)
            {
                if (!string.IsNullOrWhiteSpace(t.Label))
                    return t.Label.Trim();
            }

            foreach (var s in row.Subject)
            {
                if (!string.IsNullOrWhiteSpace(s.Label))
                    return s.Label.Trim();
            }
        }

        return FallbackTopicForQuestionNumber(questionNumber1Based);
    }

    /// <summary>ML konu üretmediğinde geçici dağılım (UI tamamen "Bilinmiyor" göstermesin diye).</summary>
    private static string FallbackTopicForQuestionNumber(int questionNumber1Based)
    {
        string[] buckets =
        [
            "Sözcükte Anlam",
            "Cümlede Anlam",
            "Paragraf",
            "Dil Bilgisi",
            "Yazım ve Noktalama",
            "Şiir / Edebiyat",
            "Yazım Kuralları"
        ];
        var idx = Math.Max(0, questionNumber1Based - 1) % buckets.Length;
        return buckets[idx];
    }

    /// <summary>
    /// wrongTopics özetini yanlış soru listesinden türetir; toplam yanlış sayısı ile her zaman tutarlı kalır.
    /// </summary>
    private static List<WrongTopicDto> BuildWrongTopicsFromWrongQuestions(IReadOnlyList<WrongQuestionDto> wrongQuestions)
    {
        var topicCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var wq in wrongQuestions)
        {
            var key = string.IsNullOrWhiteSpace(wq.Topic) ? "Bilinmiyor" : wq.Topic.Trim();
            topicCounts[key] = topicCounts.GetValueOrDefault(key, 0) + 1;
        }

        return topicCounts.Select(kv => new WrongTopicDto(kv.Key, kv.Value)).ToList();
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
        var wrongQuestions = string.IsNullOrEmpty(r.WrongQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(r.WrongQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();
        var topicsFromJson = (JsonSerializer.Deserialize<List<WrongTopicDto>>(r.WrongTopicsJson)
                ?? new List<WrongTopicDto>())
            .Select(t =>
            {
                var raw = t.Topic;
                var label = raw is null
                    ? "Bilinmiyor"
                    : string.IsNullOrWhiteSpace(raw)
                        ? "Konu atanmamış"
                        : raw.Trim();
                return new WrongTopicDto(label, t.Count);
            })
            .ToList();
        var sumTopicCounts = topicsFromJson.Sum(t => t.Count);
        var topics = wrongQuestions.Count > 0 && sumTopicCounts != wrongQuestions.Count
            ? BuildWrongTopicsFromWrongQuestions(wrongQuestions)
            : topicsFromJson;
        var correctQuestions = string.IsNullOrEmpty(r.CorrectQuestionsJson)
            ? new List<WrongQuestionDto>()
            : JsonSerializer.Deserialize<List<WrongQuestionDto>>(r.CorrectQuestionsJson, JsonStoreOptions) ?? new List<WrongQuestionDto>();
        var suspiciousQuestions = string.IsNullOrEmpty(r.SuspiciousQuestionsJson)
            ? new List<SuspiciousQuestionHintDto>()
            : JsonSerializer.Deserialize<List<SuspiciousQuestionHintDto>>(r.SuspiciousQuestionsJson, JsonStoreOptions)
              ?? new List<SuspiciousQuestionHintDto>();
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
            r.CreatedAt,
            suspiciousQuestions,
            r.SuspiciousReviewedAt
        );
    }
}
