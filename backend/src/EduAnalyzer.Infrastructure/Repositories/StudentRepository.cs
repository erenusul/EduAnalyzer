using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class StudentRepository : IStudentRepository
{
    private readonly AppDbContext _context;

    public StudentRepository(AppDbContext context) => _context = context;

    public async Task<Student?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<Student?> GetByEmailWithoutUserAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim();
        if (string.IsNullOrEmpty(normalized))
            return null;

        return await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.UserId == null && s.Email != null && s.Email.ToLower() == normalized.ToLower(),
                ct);
    }

    public async Task<IReadOnlyList<Student>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default) =>
        await _context.Students
            .Include(s => s.Class)
            .Where(s => s.TeacherId == teacherId)
            .OrderBy(s => s.LastName)
            .ThenBy(s => s.FirstName)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Student>> GetByClassIdAsync(Guid classId, CancellationToken ct = default) =>
        await _context.Students
            .Include(s => s.Class)
            .Where(s => s.ClassId == classId)
            .OrderBy(s => s.StudentNo)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Student>> GetByParentIdAsync(Guid parentId, CancellationToken ct = default)
    {
        var pairs = await _context.StudentParents
            .Include(sp => sp.Student)
            .ThenInclude(s => s!.Class)
            .Where(sp => sp.ParentId == parentId)
            .ToListAsync(ct);
        return pairs.Select(sp => sp.Student).OrderBy(s => s.LastName).ThenBy(s => s.FirstName).ToList();
    }

    public async Task<Student> AddAsync(Student entity, User? appUser = null, CancellationToken ct = default)
    {
        if (appUser != null)
        {
            if (entity.UserId != appUser.Id)
                throw new ArgumentException("Öğrenci UserId, uygulama kullanıcısı Id ile eşleşmelidir.", nameof(entity));
            _context.Users.Add(appUser);
        }

        _context.Students.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(Student entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _context.Students.Update(entity);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _context.Students.FindAsync([id], ct);
        if (entity != null)
        {
            _context.Students.Remove(entity);
            await _context.SaveChangesAsync(ct);
        }
    }
}
