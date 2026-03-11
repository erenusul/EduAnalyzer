using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Moq;

namespace EduAnalyzer.Tests;

public class AnalysisServiceTests
{
    [Fact]
    public async Task CreateFromPdfAsync_CreatesAnalysisRecord_WithMlResult()
    {
        var teacherId = Guid.NewGuid();
        var mlResult = new PdfAnalysisResponseDto(
            TotalQuestions: 20,
            AnalyzedQuestions: 18,
            Results: new List<QuestionAnalysisResultDto>
            {
                new(
                    "q1",
                    "Soru metni",
                    new List<PredictionItemDto> { new("Matematik", 0.9) },
                    new List<PredictionItemDto> { new("Üslü Sayılar", 0.85) },
                    false
                ),
            },
            Warning: null
        );

        AnalysisRecord? capturedEntity = null;
        var analysisRepo = new Mock<IAnalysisRecordRepository>();
        analysisRepo
            .Setup(x => x.AddAsync(It.IsAny<AnalysisRecord>(), It.IsAny<CancellationToken>()))
            .Callback<AnalysisRecord, CancellationToken>((e, _) => capturedEntity = e)
            .ReturnsAsync((AnalysisRecord e, CancellationToken _) => e);

        var examRepo = new Mock<IExamRepository>();

        var service = new AnalysisService(analysisRepo.Object, examRepo.Object);

        var result = await service.CreateFromPdfAsync(
            teacherId,
            "Deneme 1",
            "sinav.pdf",
            mlResult
        );

        Assert.NotNull(result);
        Assert.Equal("pdf", result.Type);
        Assert.Equal("Deneme 1", result.Title);
        Assert.Equal("sinav.pdf", result.FileName);
        Assert.Equal(20, result.TotalQuestions);
        Assert.Equal(18, result.AnalyzedQuestions);

        Assert.NotNull(capturedEntity);
        Assert.Equal(teacherId, capturedEntity.TeacherId);
        Assert.Equal(AnalysisType.Pdf, capturedEntity.Type);
        Assert.Equal("Deneme 1", capturedEntity.Title);
        Assert.Equal("sinav.pdf", capturedEntity.FileName);
        Assert.Equal(20, capturedEntity.TotalQuestions);
        Assert.Equal(18, capturedEntity.AnalyzedQuestions);
        Assert.Contains("TotalQuestions", capturedEntity.ResultsJson);
        Assert.Contains("Results", capturedEntity.ResultsJson);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenAnalysisNotFound()
    {
        var id = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var analysisRepo = new Mock<IAnalysisRecordRepository>();
        analysisRepo.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AnalysisRecord?)null);

        var examRepo = new Mock<IExamRepository>();
        var service = new AnalysisService(analysisRepo.Object, examRepo.Object);

        var result = await service.GetByIdAsync(id, teacherId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenTeacherIdMismatch()
    {
        var id = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var otherTeacherId = Guid.NewGuid();
        var entity = new AnalysisRecord
        {
            Id = id,
            TeacherId = otherTeacherId,
            Type = AnalysisType.Pdf,
            Title = "Test",
            Date = DateTime.UtcNow,
            TotalQuestions = 20,
            AnalyzedQuestions = 20,
            ResultsJson = "{}",
            CreatedAt = DateTime.UtcNow,
        };

        var analysisRepo = new Mock<IAnalysisRecordRepository>();
        analysisRepo.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(entity);

        var examRepo = new Mock<IExamRepository>();
        var service = new AnalysisService(analysisRepo.Object, examRepo.Object);

        var result = await service.GetByIdAsync(id, teacherId);

        Assert.Null(result);
    }
}
