using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using EduAnalyzer.Domain.Entities;
using Microsoft.Extensions.Options;
using Moq;

namespace EduAnalyzer.Tests;

public class AuthServiceTests
{
    private static IAuthService CreateAuthService(
        Mock<IUserRepository>? userRepo = null,
        Mock<ITeacherRepository>? teacherRepo = null,
        JwtOptions? jwtOptions = null)
    {
        userRepo ??= new Mock<IUserRepository>();
        teacherRepo ??= new Mock<ITeacherRepository>();
        jwtOptions ??= new JwtOptions
        {
            Secret = "EduAnalyzer-TestSecret-Min32CharactersRequired!",
            Issuer = "EduAnalyzer",
            Audience = "EduAnalyzer",
            ExpirationMinutes = 60
        };

        return new AuthService(
            userRepo.Object,
            teacherRepo.Object,
            Options.Create(jwtOptions));
    }

    [Fact]
    public void HashPassword_ProducesConsistentOutput()
    {
        var service = CreateAuthService();
        var password = "demo123";
        var hash1 = service.HashPassword(password);
        var hash2 = service.HashPassword(password);
        Assert.Equal(hash1, hash2);
        Assert.NotEmpty(hash1);
    }

    [Fact]
    public void VerifyPassword_ReturnsTrue_WhenPasswordMatches()
    {
        var service = CreateAuthService();
        var password = "demo123";
        var hash = service.HashPassword(password);
        Assert.True(service.VerifyPassword(password, hash));
    }

    [Fact]
    public void VerifyPassword_ReturnsFalse_WhenPasswordDoesNotMatch()
    {
        var service = CreateAuthService();
        var hash = service.HashPassword("demo123");
        Assert.False(service.VerifyPassword("wrongpassword", hash));
    }

    [Fact]
    public async Task LoginAsync_ReturnsNull_WhenUserNotFound()
    {
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(x => x.GetByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        var service = CreateAuthService(userRepo: userRepo);
        var result = await service.LoginAsync(new LoginRequest("nonexistent@test.com", "demo123"));
        Assert.Null(result);
    }

    [Fact]
    public async Task LoginAsync_ReturnsNull_WhenPasswordWrong()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "ogretmen@demo.com",
            DisplayName = "Demo",
            PasswordHash = CreateAuthService().HashPassword("correct"),
            Role = UserRole.Teacher,
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var teacherRepo = new Mock<ITeacherRepository>();
        teacherRepo.Setup(x => x.GetByUserIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Teacher { Id = Guid.NewGuid(), UserId = user.Id, SchoolName = "Test", CreatedAt = DateTime.UtcNow });

        var service = CreateAuthService(userRepo: userRepo, teacherRepo: teacherRepo);
        var result = await service.LoginAsync(new LoginRequest(user.Email, "wrongpassword"));
        Assert.Null(result);
    }

    [Fact]
    public async Task LoginAsync_ReturnsToken_WhenCredentialsValid()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "ogretmen@demo.com",
            DisplayName = "Demo Öğretmen",
            PasswordHash = CreateAuthService().HashPassword("demo123"),
            Role = UserRole.Teacher,
            CreatedAt = DateTime.UtcNow
        };

        var teacher = new Teacher
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            SchoolName = "Demo Okul",
            CreatedAt = DateTime.UtcNow
        };

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(x => x.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var teacherRepo = new Mock<ITeacherRepository>();
        teacherRepo.Setup(x => x.GetByUserIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(teacher);

        var service = CreateAuthService(userRepo: userRepo, teacherRepo: teacherRepo);
        var result = await service.LoginAsync(new LoginRequest(user.Email, "demo123"));

        Assert.NotNull(result);
        Assert.NotEmpty(result.AccessToken);
        Assert.Equal("Bearer", result.TokenType);
        Assert.Equal(user.Email, result.User.Email);
        Assert.Equal(user.DisplayName, result.User.DisplayName);
    }
}
