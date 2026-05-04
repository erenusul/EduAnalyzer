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
    DateTime CreatedAt,
    bool HasAppAccount
);

public record CreateStudentRequest(
    string StudentNo,
    string FirstName,
    string LastName,
    Guid? ClassId,
    string? Email,
    string? Phone,
    string? Notes,
    string? Password
);

public record UpdateStudentRequest(
    string? StudentNo,
    string? FirstName,
    string? LastName,
    Guid? ClassId,
    string? Email,
    string? Phone,
    string? Notes,
    string? Password
);

/// <summary>Öğrenciye bağlı veli (StudentParent + kullanıcı bilgisi).</summary>
public record StudentParentLinkDto(
    Guid ParentId,
    string Email,
    string DisplayName,
    bool IsPrimary);

/// <summary>Veli ekleme listesinde seçilebilir Parent kayıtları.</summary>
public record ParentCandidateDto(Guid ParentId, string Email, string DisplayName);

public record AddStudentParentRequest(Guid ParentId);

/// <summary>Öğretmenin oluşturduğu yeni veli giriş hesabı (User + Parent).</summary>
public record CreateParentAccountRequest(
    string Email,
    string Password,
    string DisplayName,
    string? Phone = null);
