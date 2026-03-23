using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Services;

public interface IStudentService
{
    Task<StudentDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentDto>> GetByClassAsync(Guid classId, Guid teacherId, CancellationToken ct = default);
    Task<StudentDto> CreateAsync(Guid teacherId, CreateStudentRequest request, CancellationToken ct = default);
    Task<StudentDto?> UpdateAsync(Guid id, Guid teacherId, UpdateStudentRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<bool> AssignToClassAsync(Guid studentId, Guid? classId, Guid teacherId, CancellationToken ct = default);
}

public class StudentService : IStudentService
{
    private const int MinPasswordLength = 6;

    private readonly IStudentRepository _repo;
    private readonly IClassRepository _classRepo;
    private readonly IUserRepository _userRepo;
    private readonly IAuthService _auth;

    public StudentService(
        IStudentRepository repo,
        IClassRepository classRepo,
        IUserRepository userRepo,
        IAuthService auth)
    {
        _repo = repo;
        _classRepo = classRepo;
        _userRepo = userRepo;
        _auth = auth;
    }

    public async Task<StudentDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return null;
        return MapToDto(s);
    }

    public async Task<IReadOnlyList<StudentDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _repo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<StudentDto>> GetByClassAsync(Guid classId, Guid teacherId, CancellationToken ct = default)
    {
        var cls = await _classRepo.GetByIdAsync(classId, ct);
        if (cls == null || cls.TeacherId != teacherId) return [];
        var list = await _repo.GetByClassIdAsync(classId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<StudentDto> CreateAsync(Guid teacherId, CreateStudentRequest request, CancellationToken ct = default)
    {
        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        var wantsAccount = !string.IsNullOrWhiteSpace(request.Password);

        if (wantsAccount)
        {
            if (string.IsNullOrEmpty(email))
                throw new InvalidOperationException("Mobil uygulama girişi için e-posta zorunludur.");
            if (request.Password!.Length < MinPasswordLength)
                throw new InvalidOperationException($"Şifre en az {MinPasswordLength} karakter olmalıdır.");

            var existing = await _userRepo.GetByEmailAsync(email, ct);
            if (existing != null)
                throw new InvalidOperationException("Bu e-posta adresi zaten kayıtlı.");

            var userId = Guid.NewGuid();
            var displayName = $"{request.FirstName.Trim()} {request.LastName.Trim()}".Trim();
            var user = new User
            {
                Id = userId,
                Email = email,
                DisplayName = string.IsNullOrEmpty(displayName) ? email : displayName,
                PasswordHash = _auth.HashPassword(request.Password!),
                Role = UserRole.Student,
                CreatedAt = DateTime.UtcNow
            };

            var entity = new Student
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TeacherId = teacherId,
                StudentNo = request.StudentNo,
                FirstName = request.FirstName,
                LastName = request.LastName,
                ClassId = request.ClassId,
                Email = email,
                Phone = request.Phone,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow
            };

            var added = await _repo.AddAsync(entity, user, ct);
            return MapToDto(added);
        }

        var plain = new Student
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            StudentNo = request.StudentNo,
            FirstName = request.FirstName,
            LastName = request.LastName,
            ClassId = request.ClassId,
            Email = email,
            Phone = request.Phone,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };
        var saved = await _repo.AddAsync(plain, null, ct);
        return MapToDto(saved);
    }

    public async Task<StudentDto?> UpdateAsync(Guid id, Guid teacherId, UpdateStudentRequest request, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return null;

        if (request.StudentNo != null) s.StudentNo = request.StudentNo;
        if (request.FirstName != null) s.FirstName = request.FirstName;
        if (request.LastName != null) s.LastName = request.LastName;
        if (request.ClassId != null) s.ClassId = request.ClassId;
        if (request.Phone != null) s.Phone = request.Phone;
        if (request.Notes != null) s.Notes = request.Notes;
        if (request.Email != null)
            s.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

        if (s.UserId.HasValue && request.Email != null && !string.IsNullOrWhiteSpace(s.Email))
        {
            var user = await _userRepo.GetByIdAsync(s.UserId.Value, ct);
            if (user != null && user.Email != s.Email)
            {
                var taken = await _userRepo.GetByEmailAsync(s.Email, ct);
                if (taken != null && taken.Id != user.Id)
                    throw new InvalidOperationException("Bu e-posta adresi zaten kayıtlı.");
                user.Email = s.Email;
                await _userRepo.UpdateAsync(user, ct);
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
            await ApplyStudentPasswordAsync(s, request.Password, ct);

        await _repo.UpdateAsync(s, ct);
        return MapToDto(s);
    }

    private async Task ApplyStudentPasswordAsync(Student s, string password, CancellationToken ct)
    {
        if (password.Length < MinPasswordLength)
            throw new InvalidOperationException($"Şifre en az {MinPasswordLength} karakter olmalıdır.");

        var email = s.Email?.Trim();
        if (string.IsNullOrEmpty(email))
            throw new InvalidOperationException("Mobil uygulama girişi için öğrenci e-postası zorunludur.");

        if (s.UserId == null)
        {
            var existing = await _userRepo.GetByEmailAsync(email, ct);
            if (existing != null)
                throw new InvalidOperationException("Bu e-posta adresi zaten kayıtlı.");

            var userId = Guid.NewGuid();
            var displayName = $"{s.FirstName.Trim()} {s.LastName.Trim()}".Trim();
            var user = new User
            {
                Id = userId,
                Email = email,
                DisplayName = string.IsNullOrEmpty(displayName) ? email : displayName,
                PasswordHash = _auth.HashPassword(password),
                Role = UserRole.Student,
                CreatedAt = DateTime.UtcNow
            };
            await _userRepo.AddAsync(user, ct);
            s.UserId = userId;
        }
        else
        {
            var user = await _userRepo.GetByIdAsync(s.UserId.Value, ct);
            if (user == null)
                throw new InvalidOperationException("Öğrenci hesabı bulunamadı.");
            user.PasswordHash = _auth.HashPassword(password);
            await _userRepo.UpdateAsync(user, ct);
        }
    }

    public async Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return false;
        var userId = s.UserId;
        await _repo.DeleteAsync(id, ct);
        if (userId.HasValue)
            await _userRepo.DeleteAsync(userId.Value, ct);
        return true;
    }

    public async Task<bool> AssignToClassAsync(Guid studentId, Guid? classId, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(studentId, ct);
        if (s == null || s.TeacherId != teacherId) return false;
        if (classId.HasValue)
        {
            var cls = await _classRepo.GetByIdAsync(classId.Value, ct);
            if (cls == null || cls.TeacherId != teacherId) return false;
        }
        s.ClassId = classId;
        await _repo.UpdateAsync(s, ct);
        return true;
    }

    public static StudentDto MapToDto(Student s) => new(
        s.Id,
        s.StudentNo,
        s.FirstName,
        s.LastName,
        s.ClassId,
        s.Class?.Name,
        s.Email,
        s.Phone,
        s.Notes,
        s.CreatedAt,
        s.UserId.HasValue
    );
}
