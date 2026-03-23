using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Moq;

namespace EduAnalyzer.Tests;

public class StudentServiceTests
{
    [Fact]
    public async Task GetByTeacherAsync_ReturnsEmptyList_WhenNoStudents()
    {
        var teacherId = Guid.NewGuid();
        var repo = new Mock<IStudentRepository>();
        repo.Setup(x => x.GetByTeacherIdAsync(teacherId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Student>());

        var classRepo = new Mock<IClassRepository>();
        var userRepo = new Mock<IUserRepository>();
        var auth = new Mock<IAuthService>();
        var service = new StudentService(repo.Object, classRepo.Object, userRepo.Object, auth.Object);

        var result = await service.GetByTeacherAsync(teacherId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetByTeacherAsync_ReturnsMappedStudents_WhenStudentsExist()
    {
        var teacherId = Guid.NewGuid();
        var student = new Student
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            StudentNo = "1001",
            FirstName = "Ahmet",
            LastName = "Yılmaz",
            ClassId = null,
            CreatedAt = DateTime.UtcNow
        };

        var repo = new Mock<IStudentRepository>();
        repo.Setup(x => x.GetByTeacherIdAsync(teacherId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Student> { student });

        var classRepo = new Mock<IClassRepository>();
        var userRepo = new Mock<IUserRepository>();
        var auth = new Mock<IAuthService>();
        var service = new StudentService(repo.Object, classRepo.Object, userRepo.Object, auth.Object);

        var result = await service.GetByTeacherAsync(teacherId);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("1001", result[0].StudentNo);
        Assert.Equal("Ahmet", result[0].FirstName);
        Assert.Equal("Yılmaz", result[0].LastName);
        Assert.False(result[0].HasAppAccount);
    }
}
