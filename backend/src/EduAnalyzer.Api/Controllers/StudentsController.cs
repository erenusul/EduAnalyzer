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

    public StudentsController(IStudentService service, IExamService examService)
    {
        _service = service;
        _examService = examService;
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
        var dto = await _service.CreateAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudentDto>> Update(Guid id, [FromBody] UpdateStudentRequest request, CancellationToken ct)
    {
        var dto = await _service.UpdateAsync(id, TeacherId, request, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
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
}

public record AssignClassRequest(Guid? ClassId);
