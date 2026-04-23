using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Interfaces;

public interface IStudentRepository
{
    Task<Student?> GetByIdAsync(Guid id, CancellationToken ct = default);
    /// <summary>Mobil User bağlı olmayan öğrenci (e-posta ile giriş bekleyen).</summary>
    Task<Student?> GetByEmailWithoutUserAsync(string email, CancellationToken ct = default);
    Task<IReadOnlyList<Student>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<Student>> GetByClassIdAsync(Guid classId, CancellationToken ct = default);
    Task<IReadOnlyList<Student>> GetByParentIdAsync(Guid parentId, CancellationToken ct = default);
    Task<Student> AddAsync(Student entity, User? appUser = null, CancellationToken ct = default);
    Task UpdateAsync(Student entity, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IClassRepository
{
    Task<Class?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Class>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default);
    Task<Class> AddAsync(Class entity, CancellationToken ct = default);
    Task UpdateAsync(Class entity, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IAnalysisRecordRepository
{
    Task<AnalysisRecord?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<AnalysisRecord>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default);
    Task<AnalysisRecord> AddAsync(AnalysisRecord entity, CancellationToken ct = default);
    Task UpdateAsync(AnalysisRecord entity, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IExamRepository
{
    Task<Exam?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Exam?> GetByAnalysisIdAsync(Guid analysisId, CancellationToken ct = default);
    Task<IReadOnlyList<Exam>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default);
    Task<Exam> AddAsync(Exam entity, CancellationToken ct = default);
    Task UpdateAsync(Exam entity, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IExamResultRepository
{
    Task<ExamResult?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResult>> GetByStudentIdAsync(Guid studentId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResult>> GetByExamIdAsync(Guid examId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResult>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default);
    Task<ExamResult> AddAsync(ExamResult entity, CancellationToken ct = default);
    Task UpdateAsync(ExamResult entity, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<int> DeleteByExamIdAsync(Guid examId, CancellationToken ct = default);
}

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User> AddAsync(User entity, CancellationToken ct = default);
    Task UpdateAsync(User entity, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IStudentParentRepository
{
    Task<IReadOnlyList<StudentParent>> GetLinksWithParentAndUserAsync(Guid studentId, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid studentId, Guid parentId, CancellationToken ct = default);
    Task AddAsync(StudentParent entity, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid studentId, Guid parentId, CancellationToken ct = default);
}

public interface IParentReadRepository
{
    Task<Parent?> GetByIdWithUserAsync(Guid parentId, CancellationToken ct = default);
    Task<IReadOnlyList<Parent>> ListParentsWithUserAsync(CancellationToken ct = default);
}

public interface ITeacherRepository
{
    Task<Teacher?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Teacher?> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<Teacher> AddAsync(Teacher entity, CancellationToken ct = default);
}
