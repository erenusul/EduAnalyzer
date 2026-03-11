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

    [HttpGet("results")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetMyResults(CancellationToken ct)
    {
        var studentIdStr = User.FindFirstValue("StudentId");
        if (string.IsNullOrEmpty(studentIdStr) || !Guid.TryParse(studentIdStr, out var studentId))
            return Forbid();

        var list = await _examService.GetResultsByStudentForSelfAsync(studentId, ct);
        return Ok(list);
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
