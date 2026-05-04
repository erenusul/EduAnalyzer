using EduAnalyzer.Application.DTOs;

namespace EduAnalyzer.Application.Services;

/// <summary>
/// Optik okumada geçerli sayılan ama öğretmen incelemesi için işaretlenebilecek sorular.
/// </summary>
public static class OcrSuspiciousQuestionMarker
{
    /// <summary>
    /// Bu değerin altındaki (ama red eşiğinin üstündeki) ok satırları şüpheli sayılır.
    /// </summary>
    public const double SoftConfidenceThreshold = 0.42;

    /// <summary>ML &quot;ok&quot; değil veya belirsiz/boş — mobilde yalnızca bu maddeler elle düzeltilebilir.</summary>
    public const string BelirsizOrEmptyReason = "Belirsiz veya boş okuma";

    /// <summary>Okuma &quot;ok&quot; kabul edildi ancak güven sınırda — elle düzeltme gerekli değil.</summary>
    public const string BorderlineConfidenceReason = "Sınırda güven skoru";

    public static IReadOnlyList<SuspiciousQuestionHintDto> Build(
        IReadOnlyList<OpticalPerQuestionReadDto>? perQuestion)
    {
        if (perQuestion == null || perQuestion.Count == 0)
            return Array.Empty<SuspiciousQuestionHintDto>();

        var list = new List<SuspiciousQuestionHintDto>();
        for (var i = 0; i < perQuestion.Count; i++)
        {
            var q = perQuestion[i];
            var st = (q.Status ?? "").Trim().ToLowerInvariant();
            if (st != "ok")
            {
                list.Add(new SuspiciousQuestionHintDto(
                    i + 1,
                    q.Confidence,
                    q.Status,
                    BelirsizOrEmptyReason));
                continue;
            }

            if (q.Confidence < SoftConfidenceThreshold
                && q.Confidence + 1e-9 >= OpticalScanStrictValidator.MinOkConfidence)
            {
                list.Add(new SuspiciousQuestionHintDto(
                    i + 1,
                    q.Confidence,
                    q.Status,
                    BorderlineConfidenceReason));
            }
        }

        return list;
    }
}
