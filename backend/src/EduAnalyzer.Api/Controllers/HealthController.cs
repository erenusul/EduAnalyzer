using EduAnalyzer.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly IMlServiceClient _mlClient;

    public HealthController(IMlServiceClient mlClient) => _mlClient = mlClient;

    [HttpGet]
    public async Task<ActionResult<object>> Get(CancellationToken ct)
    {
        try
        {
            var ml = await _mlClient.CheckHealthAsync(ct);
            return Ok(new { status = "healthy", mlService = ml });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                status = "healthy",
                mlService = new { status = "unreachable", message = ex.Message }
            });
        }
    }
}
