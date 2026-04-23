using System.IO;
using System.Linq;
using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Exceptions;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Moq;

namespace EduAnalyzer.Tests;

public class ExamServiceTests
{
    [Fact]
    public async Task GetResultsByStudentForSelfAsync_ReturnsEmptyList_WhenStudentNotFound()
    {
        var studentId = Guid.NewGuid();
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Student?)null);

        var examRepo = new Mock<IExamRepository>();
        var resultRepo = new Mock<IExamResultRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var result = await service.GetResultsByStudentForSelfAsync(studentId);

        Assert.NotNull(result);
        Assert.Empty(result);
        resultRepo.Verify(x => x.GetByStudentIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetStudentsWithResultsForParentAsync_ReturnsEmptyList_WhenNoStudents()
    {
        var parentId = Guid.NewGuid();
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByParentIdAsync(parentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Student>());

        var examRepo = new Mock<IExamRepository>();
        var resultRepo = new Mock<IExamResultRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var result = await service.GetStudentsWithResultsForParentAsync(parentId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetStudentsWithResultsForParentAsync_ReturnsStudentsWithResults_WhenStudentsExist()
    {
        var parentId = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var student = new Student
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            StudentNo = "1001",
            FirstName = "Ali",
            LastName = "Veli",
            ClassId = null,
            CreatedAt = DateTime.UtcNow
        };

        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            AnalysisId = Guid.NewGuid(),
            TeacherId = teacherId,
            Title = "Deneme 1",
            WeekLabel = "Hafta 1",
            Date = DateTime.UtcNow,
            Status = ExamStatus.Ready,
            CreatedAt = DateTime.UtcNow
        };

        var examResult = new ExamResult
        {
            Id = Guid.NewGuid(),
            StudentId = student.Id,
            ExamId = exam.Id,
            CorrectCount = 8,
            WrongCount = 2,
            WrongTopicsJson = "[]",
            Source = "manual",
            CreatedAt = DateTime.UtcNow,
            Student = student,
            Exam = exam
        };

        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByParentIdAsync(parentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Student> { student });

        var examRepo = new Mock<IExamRepository>();
        var resultRepo = new Mock<IExamResultRepository>();
        var mlClient = new Mock<IMlServiceClient>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(student.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult> { examResult });

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var result = await service.GetStudentsWithResultsForParentAsync(parentId);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("1001", result[0].Student.StudentNo);
        Assert.Single(result[0].Results);
        Assert.Equal(8, result[0].Results[0].CorrectCount);
        Assert.Equal(2, result[0].Results[0].WrongCount);
    }

    [Fact]
    public async Task DeleteExamAsync_DeletesResultsThenExam_WhenTeacherOwnsExam()
    {
        var teacherId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = Guid.NewGuid(),
            TeacherId = teacherId,
            Title = "Silinecek",
            WeekLabel = "2026-W01",
            Date = DateTime.UtcNow,
            Status = ExamStatus.Ready,
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(exam);
        examRepo.Setup(x => x.DeleteAsync(examId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.DeleteByExamIdAsync(examId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        var studentRepo = new Mock<IStudentRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await service.DeleteExamAsync(examId, teacherId);

        resultRepo.Verify(x => x.DeleteByExamIdAsync(examId, It.IsAny<CancellationToken>()), Times.Once);
        examRepo.Verify(x => x.DeleteAsync(examId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteExamAsync_ThrowsUnauthorized_WhenTeacherMismatch()
    {
        var examId = Guid.NewGuid();
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = Guid.NewGuid(),
            TeacherId = Guid.NewGuid(),
            Title = "X",
            WeekLabel = "W1",
            Date = DateTime.UtcNow,
            Status = ExamStatus.Ready,
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(exam);

        var resultRepo = new Mock<IExamResultRepository>();
        var studentRepo = new Mock<IStudentRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.DeleteExamAsync(examId, Guid.NewGuid()));

        resultRepo.Verify(x => x.DeleteByExamIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteExamResultForStudentSelfAsync_Deletes_WhenStudentOwnsResult()
    {
        var studentId = Guid.NewGuid();
        var resultId = Guid.NewGuid();
        var entity = new ExamResult
        {
            Id = resultId,
            StudentId = studentId,
            ExamId = Guid.NewGuid(),
            CorrectCount = 1,
            WrongCount = 1,
            WrongTopicsJson = "[]",
            Source = "optical",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByIdAsync(resultId, It.IsAny<CancellationToken>())).ReturnsAsync(entity);
        resultRepo.Setup(x => x.DeleteAsync(resultId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var studentRepo = new Mock<IStudentRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await service.DeleteExamResultForStudentSelfAsync(resultId, studentId);

        resultRepo.Verify(x => x.DeleteAsync(resultId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteExamResultForStudentSelfAsync_Throws_WhenOtherStudent()
    {
        var resultId = Guid.NewGuid();
        var entity = new ExamResult
        {
            Id = resultId,
            StudentId = Guid.NewGuid(),
            ExamId = Guid.NewGuid(),
            CorrectCount = 1,
            WrongCount = 0,
            WrongTopicsJson = "[]",
            Source = "optical",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByIdAsync(resultId, It.IsAny<CancellationToken>())).ReturnsAsync(entity);
        var studentRepo = new Mock<IStudentRepository>();
        var mlClient = new Mock<IMlServiceClient>();

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.DeleteExamResultForStudentSelfAsync(resultId, Guid.NewGuid()));

        resultRepo.Verify(x => x.DeleteAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SubmitScanForStudentAsync_ThrowsOpticalScanRejected_WhenPerspectiveNotOk()
    {
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var analysis = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            ClassId = null,
            ResultsJson = "{}",
            Title = "t",
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = analysis.Id,
            TeacherId = teacherId,
            Status = ExamStatus.Ready,
            Title = "E",
            WeekLabel = "W",
            Date = DateTime.UtcNow,
            AnswerKeyJson = JsonSerializer.Serialize(new List<string> { "A", "A" }),
            CreatedAt = DateTime.UtcNow,
            Analysis = analysis
        };
        var student = new Student
        {
            Id = studentId,
            TeacherId = teacherId,
            StudentNo = "1",
            FirstName = "a",
            LastName = "b",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>())).ReturnsAsync(exam);
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult>());
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        var mlClient = new Mock<IMlServiceClient>();
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("A", "ok", 0.95),
            new("A", "ok", 0.95)
        };
        mlClient
            .Setup(x => x.ScanOpticalFormAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OpticalScanResultDto(
                new[] { "A", "A" },
                2,
                true,
                false,
                per));

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await Assert.ThrowsAsync<OpticalScanRejectedException>(() =>
            service.SubmitScanForStudentAsync(examId, studentId, new MemoryStream(), 2, null, null, null, default));

        resultRepo.Verify(x => x.AddAsync(It.IsAny<ExamResult>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SubmitScanForStudentAsync_ThrowsOpticalScanRejected_WhenConfidenceTooLow()
    {
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var analysis = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            ClassId = null,
            ResultsJson = "{}",
            Title = "t",
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = analysis.Id,
            TeacherId = teacherId,
            Status = ExamStatus.Ready,
            Title = "E",
            WeekLabel = "W",
            Date = DateTime.UtcNow,
            AnswerKeyJson = JsonSerializer.Serialize(new List<string> { "A" }),
            CreatedAt = DateTime.UtcNow,
            Analysis = analysis
        };
        var student = new Student
        {
            Id = studentId,
            TeacherId = teacherId,
            StudentNo = "1",
            FirstName = "a",
            LastName = "b",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>())).ReturnsAsync(exam);
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult>());
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        var mlClient = new Mock<IMlServiceClient>();
        var per = new List<OpticalPerQuestionReadDto> { new("A", "ok", 0.05) };
        mlClient
            .Setup(x => x.ScanOpticalFormAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OpticalScanResultDto(
                new[] { "A" },
                1,
                true,
                true,
                per));

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        await Assert.ThrowsAsync<OpticalScanRejectedException>(() =>
            service.SubmitScanForStudentAsync(examId, studentId, new MemoryStream(), 1, null, null, null, default));

        resultRepo.Verify(x => x.AddAsync(It.IsAny<ExamResult>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SubmitScanForStudentAsync_NormalizesReadE_ToEmpty_WhenAnswerKeyHasNoE()
    {
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var pdfPayload = new PdfAnalysisResponseDto(
            TotalQuestions: 1,
            AnalyzedQuestions: 1,
            Results: new List<QuestionAnalysisResultDto>
            {
                new(
                    "1",
                    "Soru",
                    new List<PredictionItemDto>(),
                    new List<PredictionItemDto> { new("Konu", 1.0) },
                    false),
            },
            Warning: null);
        var analysis = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            ClassId = null,
            ResultsJson = JsonSerializer.Serialize(pdfPayload),
            Title = "t",
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = analysis.Id,
            TeacherId = teacherId,
            Status = ExamStatus.Ready,
            Title = "Türkçe",
            WeekLabel = "W",
            Date = DateTime.UtcNow,
            AnswerKeyJson = JsonSerializer.Serialize(new List<string> { "B" }),
            CreatedAt = DateTime.UtcNow,
            Analysis = analysis
        };
        var student = new Student
        {
            Id = studentId,
            TeacherId = teacherId,
            StudentNo = "1",
            FirstName = "a",
            LastName = "b",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>())).ReturnsAsync(exam);
        ExamResult? saved = null;
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult>());
        resultRepo
            .Setup(x => x.AddAsync(It.IsAny<ExamResult>(), It.IsAny<CancellationToken>()))
            .Callback<ExamResult, CancellationToken>((e, _) => saved = e)
            .ReturnsAsync((ExamResult e, CancellationToken _) => e);
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        var mlClient = new Mock<IMlServiceClient>();
        var per = new List<OpticalPerQuestionReadDto> { new("E", "ok", 0.95) };
        mlClient
            .Setup(x => x.ScanOpticalFormAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OpticalScanResultDto(
                new[] { "E" },
                1,
                true,
                true,
                per));

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var response = await service.SubmitScanForStudentAsync(
            examId,
            studentId,
            new MemoryStream(),
            1,
            5,
            null,
            null,
            default);

        Assert.NotNull(saved);
        Assert.Equal(0, saved!.CorrectCount);
        Assert.Equal(1, saved.WrongCount);
        Assert.Equal(0, response.CorrectCount);
        Assert.Equal(1, response.WrongCount);
    }

    [Fact]
    public async Task SubmitScanForStudentAsync_UsesQuestionTopicMapping_AndWrongTopicsStayConsistent()
    {
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var pdfPayload = new PdfAnalysisResponseDto(
            TotalQuestions: 3,
            AnalyzedQuestions: 3,
            Results: new List<QuestionAnalysisResultDto>
            {
                new("1", "S1", new List<PredictionItemDto>(), new List<PredictionItemDto> { new("Sözcükte Anlam", 0.99) }, false),
                new("2", "S2", new List<PredictionItemDto>(), new List<PredictionItemDto> { new("Paragraf", 0.98) }, false),
                new("3", "S3", new List<PredictionItemDto>(), new List<PredictionItemDto> { new("Dil Bilgisi", 0.97) }, false),
            },
            Warning: null);
        var analysis = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            ClassId = null,
            ResultsJson = JsonSerializer.Serialize(pdfPayload),
            Title = "t",
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = analysis.Id,
            TeacherId = teacherId,
            Status = ExamStatus.Ready,
            Title = "Türkçe",
            WeekLabel = "W",
            Date = DateTime.UtcNow,
            AnswerKeyJson = JsonSerializer.Serialize(new List<string> { "A", "B", "C" }),
            CreatedAt = DateTime.UtcNow,
            Analysis = analysis
        };
        var student = new Student
        {
            Id = studentId,
            TeacherId = teacherId,
            StudentNo = "1",
            FirstName = "a",
            LastName = "b",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>())).ReturnsAsync(exam);
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult>());
        resultRepo
            .Setup(x => x.AddAsync(It.IsAny<ExamResult>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ExamResult e, CancellationToken _) => e);
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        var mlClient = new Mock<IMlServiceClient>();
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("A", "ok", 0.95),
            new("D", "ok", 0.95),
            new("", "ok", 0.95),
        };
        mlClient
            .Setup(x => x.ScanOpticalFormAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OpticalScanResultDto(
                new[] { "A", "D", "" },
                3,
                true,
                true,
                per));

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var response = await service.SubmitScanForStudentAsync(
            examId,
            studentId,
            new MemoryStream(),
            3,
            4,
            null,
            null,
            default);

        Assert.Equal(1, response.CorrectCount);
        Assert.Equal(2, response.WrongCount);
        Assert.Equal(2, response.WrongQuestions.Count);
        Assert.Equal("Paragraf", response.WrongQuestions[0].Topic);
        Assert.Equal("Dil Bilgisi", response.WrongQuestions[1].Topic);

        var totalByTopics = response.WrongTopics.Sum(x => x.Count);
        Assert.Equal(response.WrongCount, totalByTopics);
        Assert.Contains(response.WrongTopics, x => x.Topic == "Paragraf" && x.Count == 1);
        Assert.Contains(response.WrongTopics, x => x.Topic == "Dil Bilgisi" && x.Count == 1);
    }

    [Fact]
    public async Task SubmitScanForStudentAsync_UsesSubjectThenFallback_WhenTopicMissing()
    {
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var examId = Guid.NewGuid();
        var pdfPayload = new PdfAnalysisResponseDto(
            TotalQuestions: 2,
            AnalyzedQuestions: 2,
            Results: new List<QuestionAnalysisResultDto>
            {
                // Topic boş, Subject dolu => Subject kullanılmalı.
                new("1", "S1", new List<PredictionItemDto> { new("Fiilde Çatı", 0.9) }, new List<PredictionItemDto>(), false),
                // Topic + Subject boş => fallback map kullanılmalı.
                new("2", "S2", new List<PredictionItemDto>(), new List<PredictionItemDto>(), false),
            },
            Warning: null);
        var analysis = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            ClassId = null,
            ResultsJson = JsonSerializer.Serialize(pdfPayload),
            Title = "t",
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        var exam = new Exam
        {
            Id = examId,
            AnalysisId = analysis.Id,
            TeacherId = teacherId,
            Status = ExamStatus.Ready,
            Title = "Türkçe",
            WeekLabel = "W",
            Date = DateTime.UtcNow,
            AnswerKeyJson = JsonSerializer.Serialize(new List<string> { "A", "B" }),
            CreatedAt = DateTime.UtcNow,
            Analysis = analysis
        };
        var student = new Student
        {
            Id = studentId,
            TeacherId = teacherId,
            StudentNo = "1",
            FirstName = "a",
            LastName = "b",
            CreatedAt = DateTime.UtcNow
        };

        var examRepo = new Mock<IExamRepository>();
        examRepo.Setup(x => x.GetByIdAsync(examId, It.IsAny<CancellationToken>())).ReturnsAsync(exam);
        var resultRepo = new Mock<IExamResultRepository>();
        resultRepo.Setup(x => x.GetByStudentIdAsync(studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExamResult>());
        resultRepo
            .Setup(x => x.AddAsync(It.IsAny<ExamResult>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ExamResult e, CancellationToken _) => e);
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(studentId, It.IsAny<CancellationToken>())).ReturnsAsync(student);
        var mlClient = new Mock<IMlServiceClient>();
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("D", "ok", 0.95),
            new("D", "ok", 0.95),
        };
        mlClient
            .Setup(x => x.ScanOpticalFormAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OpticalScanResultDto(
                new[] { "D", "D" },
                2,
                true,
                true,
                per));

        var service = new ExamService(examRepo.Object, resultRepo.Object, studentRepo.Object, mlClient.Object);

        var response = await service.SubmitScanForStudentAsync(
            examId,
            studentId,
            new MemoryStream(),
            2,
            4,
            null,
            null,
            default);

        Assert.Equal(2, response.WrongQuestions.Count);
        Assert.Equal("Fiilde Çatı", response.WrongQuestions[0].Topic);
        Assert.NotEqual("Bilinmiyor", response.WrongQuestions[1].Topic);
        Assert.False(string.IsNullOrWhiteSpace(response.WrongQuestions[1].Topic));
        Assert.Equal(response.WrongCount, response.WrongTopics.Sum(x => x.Count));
    }
}
