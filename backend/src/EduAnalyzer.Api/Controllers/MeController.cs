using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly IExamService _examService;

    public MeController(IExamService examService) => _examService = examService;

    private Guid? StudentIdOrNull
    {
        get
        {
            var studentIdStr = User.FindFirstValue("StudentId");
            return Guid.TryParse(studentIdStr, out var studentId) ? studentId : null;
        }
    }

    [HttpGet("results")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetMyResults(CancellationToken ct)
    {
        var studentId = StudentIdOrNull;
        if (studentId == null)
            return Forbid();

        var list = await _examService.GetResultsByStudentForSelfAsync(studentId.Value, ct);
        return Ok(list);
    }

    [HttpGet("exams")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<IReadOnlyList<ExamDto>>> GetMyAvailableExams(CancellationToken ct)
    {
        var studentId = StudentIdOrNull;
        if (studentId == null)
            return Forbid();

        var list = await _examService.GetExamsAvailableForStudentAsync(studentId.Value, ct);
        return Ok(list);
    }

    [HttpPost("exams/{id:guid}/submit-scan")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<ScanExamResponse>> SubmitScan(
        Guid id,
        [FromForm] IFormFile file,
        [FromForm] int? questionCount,
        [FromForm] int? optionCount,
        CancellationToken ct)
    {
        var studentId = StudentIdOrNull;
        if (studentId == null)
            return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest("Görsel dosyası gerekli.");

        await using var stream = file.OpenReadStream();
        var response = await _examService.SubmitScanForStudentAsync(
            id,
            studentId.Value,
            stream,
            questionCount,
            optionCount,
            ct
        );
        return Ok(response);
    }

    [HttpGet("children")]
    [Authorize(Roles = "Parent")]
    public async Task<ActionResult<IReadOnlyList<StudentWithResultsDto>>> GetMyChildren(CancellationToken ct)
    {
        var parentIdStr = User.FindFirstValue("ParentId");
        if (string.IsNullOrEmpty(parentIdStr) || !Guid.TryParse(parentIdStr, out var parentId))
            return Forbid();

        var list = await _examService.GetStudentsWithResultsForParentAsync(parentId, ct);
        return Ok(list);
    }
}
