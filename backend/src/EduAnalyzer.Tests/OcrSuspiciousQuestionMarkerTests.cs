using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Services;

namespace EduAnalyzer.Tests;

public class OcrSuspiciousQuestionMarkerTests
{
    [Fact]
    public void Build_ReturnsEmpty_WhenPerQuestionNull()
    {
        var r = OcrSuspiciousQuestionMarker.Build(null);
        Assert.Empty(r);
    }

    [Fact]
    public void Build_FlagsNonOkStatus()
    {
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("A", "ambiguous", 0.5),
            new("B", "ok", 0.95),
        };
        var r = OcrSuspiciousQuestionMarker.Build(per);
        Assert.Single(r);
        Assert.Equal(1, r[0].QuestionIndex);
        Assert.Equal("ambiguous", r[0].Status);
    }

    [Fact]
    public void Build_FlagsOkWithBorderlineConfidence()
    {
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("A", "ok", OpticalScanStrictValidator.MinOkConfidence),
            new("B", "ok", OcrSuspiciousQuestionMarker.SoftConfidenceThreshold - 0.01),
        };
        var r = OcrSuspiciousQuestionMarker.Build(per);
        Assert.Equal(2, r.Count);
        Assert.Contains(r, x => x.QuestionIndex == 1);
        Assert.Contains(r, x => x.QuestionIndex == 2);
    }

    [Fact]
    public void Build_DoesNotFlagHighConfidenceOk()
    {
        var per = new List<OpticalPerQuestionReadDto> { new("A", "ok", 0.9) };
        var r = OcrSuspiciousQuestionMarker.Build(per);
        Assert.Empty(r);
    }
}
