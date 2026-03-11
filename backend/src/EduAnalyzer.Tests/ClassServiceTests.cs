using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Moq;

namespace EduAnalyzer.Tests;

public class ClassServiceTests
{
    [Fact]
    public async Task GetByTeacherAsync_ReturnsEmptyList_WhenNoClasses()
    {
        var teacherId = Guid.NewGuid();
        var repo = new Mock<IClassRepository>();
        repo.Setup(x => x.GetByTeacherIdAsync(teacherId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Class>());

        var service = new ClassService(repo.Object);

        var result = await service.GetByTeacherAsync(teacherId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenClassNotFound()
    {
        var id = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var repo = new Mock<IClassRepository>();
        repo.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Class?)null);

        var service = new ClassService(repo.Object);

        var result = await service.GetByIdAsync(id, teacherId);

        Assert.Null(result);
    }
}
