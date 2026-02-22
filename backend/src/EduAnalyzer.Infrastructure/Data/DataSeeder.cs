using System.Security.Cryptography;
using System.Text;
using EduAnalyzer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Data;

/// <summary>
/// İlk çalıştırmada demo öğretmen ve örnek verileri ekler.
/// </summary>
public static class DataSeeder
{
    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public static async Task SeedAsync(AppDbContext context, CancellationToken ct = default)
    {
        if (await context.Users.AnyAsync(ct)) return;

        var hash = HashPassword("demo123");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "ogretmen@demo.com",
            DisplayName = "Demo Öğretmen",
            PasswordHash = hash,
            Role = UserRole.Teacher,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);

        var teacher = new Teacher
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            SchoolName = "Demo Okul",
            CreatedAt = DateTime.UtcNow
        };
        context.Teachers.Add(teacher);

        var c1 = new Class
        {
            Id = Guid.NewGuid(),
            TeacherId = teacher.Id,
            Name = "8-A",
            Grade = "8",
            AcademicYear = "2024-2025",
            CreatedAt = DateTime.UtcNow
        };
        context.Classes.Add(c1);

        var c2 = new Class
        {
            Id = Guid.NewGuid(),
            TeacherId = teacher.Id,
            Name = "8-B",
            Grade = "8",
            AcademicYear = "2024-2025",
            CreatedAt = DateTime.UtcNow
        };
        context.Classes.Add(c2);

        var students = new[]
        {
            ("1001", "Ahmet", "Yılmaz", c1.Id),
            ("1002", "Ayşe", "Kaya", c1.Id),
            ("1003", "Mehmet", "Demir", c1.Id),
            ("1004", "Zeynep", "Çelik", c2.Id),
            ("1005", "Emre", "Öztürk", c2.Id),
            ("1006", "Elif", "Arslan", (Guid?)null)
        };

        foreach (var (no, fn, ln, classId) in students)
        {
            context.Students.Add(new Student
            {
                Id = Guid.NewGuid(),
                TeacherId = teacher.Id,
                StudentNo = no,
                FirstName = fn,
                LastName = ln,
                ClassId = classId,
                CreatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync(ct);
    }
}
