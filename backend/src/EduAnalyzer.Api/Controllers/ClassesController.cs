using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher")]
public class ClassesController : ControllerBase
{
    private readonly IClassService _service;

    public ClassesController(IClassService service) => _service = service;

    private Guid TeacherId => Guid.Parse(User.FindFirstValue("TeacherId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClassDto>>> GetAll(CancellationToken ct)
    {
        var list = await _service.GetByTeacherAsync(TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, TeacherId, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ClassDto>> Create([FromBody] CreateClassRequest request, CancellationToken ct)
    {
        var dto = await _service.CreateAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClassDto>> Update(Guid id, [FromBody] UpdateClassRequest request, CancellationToken ct)
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
}
