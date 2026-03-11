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

        Student? ahmetStudent = null;
        Student? ayseStudent = null;
        foreach (var (no, fn, ln, classId) in students)
        {
            var student = new Student
            {
                Id = Guid.NewGuid(),
                TeacherId = teacher.Id,
                StudentNo = no,
                FirstName = fn,
                LastName = ln,
                ClassId = classId,
                CreatedAt = DateTime.UtcNow
            };
            context.Students.Add(student);
            if (no == "1001") ahmetStudent = student;
            if (no == "1002") ayseStudent = student;
        }

        var studentUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "ogrenci@demo.com",
            DisplayName = "Ahmet Yılmaz",
            PasswordHash = hash,
            Role = UserRole.Student,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(studentUser);
        if (ahmetStudent != null)
            ahmetStudent.UserId = studentUser.Id;

        var parentUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "veli@demo.com",
            DisplayName = "Demo Veli",
            PasswordHash = hash,
            Role = UserRole.Parent,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(parentUser);

        var parent = new Parent
        {
            Id = Guid.NewGuid(),
            UserId = parentUser.Id,
            Phone = "05XX XXX XX XX",
            CreatedAt = DateTime.UtcNow
        };
        context.Parents.Add(parent);

        if (ahmetStudent != null)
        {
            context.StudentParents.Add(new StudentParent
            {
                StudentId = ahmetStudent.Id,
                ParentId = parent.Id,
                IsPrimary = true,
                CreatedAt = DateTime.UtcNow
            });
        }
        if (ayseStudent != null)
        {
            context.StudentParents.Add(new StudentParent
            {
                StudentId = ayseStudent.Id,
                ParentId = parent.Id,
                IsPrimary = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync(ct);
    }
}
