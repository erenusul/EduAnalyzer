using EduAnalyzer.Application.DTOs;
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
}
