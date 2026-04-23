using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher")]
public class StudentsController : ControllerBase
{
    private readonly IStudentService _service;
    private readonly IExamService _examService;
    private readonly IStudentParentLinkService _parentLinkService;

    public StudentsController(
        IStudentService service,
        IExamService examService,
        IStudentParentLinkService parentLinkService)
    {
        _service = service;
        _examService = examService;
        _parentLinkService = parentLinkService;
    }

    private Guid TeacherId => Guid.Parse(User.FindFirstValue("TeacherId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentDto>>> GetAll(CancellationToken ct)
    {
        var list = await _service.GetByTeacherAsync(TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("class/{classId:guid}")]
    public async Task<ActionResult<IReadOnlyList<StudentDto>>> GetByClass(Guid classId, CancellationToken ct)
    {
        var list = await _service.GetByClassAsync(classId, TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("parent-candidates")]
    public async Task<ActionResult<IReadOnlyList<ParentCandidateDto>>> GetParentCandidates(CancellationToken ct)
    {
        var list = await _parentLinkService.GetParentCandidatesAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, TeacherId, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create([FromBody] CreateStudentRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _service.CreateAsync(TeacherId, request, ct);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudentDto>> Update(Guid id, [FromBody] UpdateStudentRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _service.UpdateAsync(id, TeacherId, request, ct);
            if (dto == null) return NotFound();
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteAsync(id, TeacherId, ct);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPatch("{id:guid}/class")]
    public async Task<ActionResult> AssignClass(Guid id, [FromBody] AssignClassRequest request, CancellationToken ct)
    {
        var ok = await _service.AssignToClassAsync(id, request.ClassId, TeacherId, ct);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpGet("{id:guid}/results")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetResults(Guid id, CancellationToken ct)
    {
        var list = await _examService.GetResultsByStudentAsync(id, TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("{studentId:guid}/parents")]
    public async Task<ActionResult<IReadOnlyList<StudentParentLinkDto>>> GetStudentParents(Guid studentId, CancellationToken ct)
    {
        var list = await _parentLinkService.GetLinkedParentsAsync(studentId, TeacherId, ct);
        if (list == null) return NotFound();
        return Ok(list);
    }

    [HttpPost("{studentId:guid}/parents")]
    public async Task<ActionResult<IReadOnlyList<StudentParentLinkDto>>> LinkStudentParent(
        Guid studentId,
        [FromBody] AddStudentParentRequest request,
        CancellationToken ct)
    {
        try
        {
            var list = await _parentLinkService.LinkParentAsync(studentId, request.ParentId, TeacherId, ct);
            if (list == null) return NotFound();
            return Ok(list);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{studentId:guid}/parents/{parentId:guid}")]
    public async Task<IActionResult> UnlinkStudentParent(Guid studentId, Guid parentId, CancellationToken ct)
    {
        var ok = await _parentLinkService.UnlinkParentAsync(studentId, parentId, TeacherId, ct);
        if (!ok) return NotFound();
        return NoContent();
    }
}

public record AssignClassRequest(Guid? ClassId);
