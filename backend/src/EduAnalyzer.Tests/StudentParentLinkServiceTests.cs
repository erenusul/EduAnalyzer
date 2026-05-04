using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Moq;

namespace EduAnalyzer.Tests;

public class StudentParentLinkServiceTests
{
    private static Student MakeStudent(Guid id, Guid teacherId) => new()
    {
        Id = id,
        TeacherId = teacherId,
        StudentNo = "1",
        FirstName = "A",
        LastName = "B",
        CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task GetLinkedParentsAsync_ReturnsNull_WhenStudentNotOwned()
    {
        var sid = Guid.NewGuid();
        var tid = Guid.NewGuid();
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(sid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStudent(sid, Guid.NewGuid()));

        var service = new StudentParentLinkService(
            studentRepo.Object,
            Mock.Of<IStudentParentRepository>(),
            Mock.Of<IParentReadRepository>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<IAuthService>());

        var r = await service.GetLinkedParentsAsync(sid, tid);
        Assert.Null(r);
    }

    [Fact]
    public async Task LinkParentAsync_IsIdempotent_WhenLinkExists()
    {
        var sid = Guid.NewGuid();
        var pid = Guid.NewGuid();
        var tid = Guid.NewGuid();
        var student = MakeStudent(sid, tid);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "v@test.com",
            DisplayName = "Veli",
            PasswordHash = "x",
            Role = UserRole.Parent,
            CreatedAt = DateTime.UtcNow
        };
        var parent = new Parent { Id = pid, UserId = user.Id, CreatedAt = DateTime.UtcNow, User = user };

        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(sid, It.IsAny<CancellationToken>())).ReturnsAsync(student);

        var linkRepo = new Mock<IStudentParentRepository>();
        linkRepo.Setup(x => x.ExistsAsync(sid, pid, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        linkRepo.Setup(x => x.GetLinksWithParentAndUserAsync(sid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StudentParent>
            {
                new()
                {
                    StudentId = sid,
                    ParentId = pid,
                    IsPrimary = true,
                    CreatedAt = DateTime.UtcNow,
                    Parent = parent
                }
            });

        var parentRepo = new Mock<IParentReadRepository>();
        parentRepo.Setup(x => x.GetByIdWithUserAsync(pid, It.IsAny<CancellationToken>())).ReturnsAsync(parent);

        var service = new StudentParentLinkService(
            studentRepo.Object,
            linkRepo.Object,
            parentRepo.Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IAuthService>());
        var list = await service.LinkParentAsync(sid, pid, tid);

        Assert.NotNull(list);
        Assert.Single(list!);
        linkRepo.Verify(x => x.AddAsync(It.IsAny<StudentParent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UnlinkParentAsync_ReturnsFalse_WhenStudentNotOwned()
    {
        var sid = Guid.NewGuid();
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(sid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStudent(sid, Guid.NewGuid()));

        var service = new StudentParentLinkService(
            studentRepo.Object,
            Mock.Of<IStudentParentRepository>(),
            Mock.Of<IParentReadRepository>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<IAuthService>());

        var ok = await service.UnlinkParentAsync(sid, Guid.NewGuid(), Guid.NewGuid());
        Assert.False(ok);
    }

    [Fact]
    public async Task UnlinkParentAsync_ReturnsTrue_WhenStudentOwned_EvenIfLinkMissing_Idempotent()
    {
        var sid = Guid.NewGuid();
        var pid = Guid.NewGuid();
        var tid = Guid.NewGuid();
        var studentRepo = new Mock<IStudentRepository>();
        studentRepo.Setup(x => x.GetByIdAsync(sid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStudent(sid, tid));

        var linkRepo = new Mock<IStudentParentRepository>();
        linkRepo.Setup(x => x.DeleteAsync(sid, pid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var service = new StudentParentLinkService(
            studentRepo.Object,
            linkRepo.Object,
            Mock.Of<IParentReadRepository>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<IAuthService>());

        var ok = await service.UnlinkParentAsync(sid, pid, tid);
        Assert.True(ok);
    }
}
