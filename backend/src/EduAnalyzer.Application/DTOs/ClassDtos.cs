namespace EduAnalyzer.Application.DTOs;

public record ClassDto(
    Guid Id,
    string Name,
    string Grade,
    string AcademicYear,
    int StudentCount,
    DateTime CreatedAt
);

public record CreateClassRequest(string Name, string Grade, string AcademicYear);

public record UpdateClassRequest(string? Name, string? Grade, string? AcademicYear);
