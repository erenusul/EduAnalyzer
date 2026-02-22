namespace EduAnalyzer.Application.DTOs;

public record StudentDto(
    Guid Id,
    string StudentNo,
    string FirstName,
    string LastName,
    Guid? ClassId,
    string? ClassName,
    string? Email,
    string? Phone,
    string? Notes,
    DateTime CreatedAt
);

public record CreateStudentRequest(
    string StudentNo,
    string FirstName,
    string LastName,
    Guid? ClassId,
    string? Email,
    string? Phone,
    string? Notes
);

public record UpdateStudentRequest(
    string? StudentNo,
    string? FirstName,
    string? LastName,
    Guid? ClassId,
    string? Email,
    string? Phone,
    string? Notes
);
