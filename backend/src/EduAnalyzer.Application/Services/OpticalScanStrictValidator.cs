using EduAnalyzer.Application.Exceptions;
using EduAnalyzer.Application.Interfaces;

namespace EduAnalyzer.Application.Services;

/// <summary>
/// ML optik yanıtı için kesin sonuç (bloklama) kuralları.
/// </summary>
public static class OpticalScanStrictValidator
{
    /// <summary>
    /// ML <c>_confidence_from_margin</c> taban değeri ~0.2; marjı dar satırlarda 0.28 üstüne çıkmayabiliyordu.
    /// </summary>
    public const double MinOkConfidence = 0.20;

    public static void EnsureAcceptable(OpticalScanResultDto result)
    {
        var per = result.PerQuestion;
        var hasRowDiagnostics = per is { Count: > 0 };

        if (hasRowDiagnostics)
        {
            if (result.MarkersDetected != true || result.PerspectiveOk != true)
            {
                throw new OpticalScanRejectedException(
                    "Köşe işaretleri algılanamadı veya görüntü çok küçük; formu düz tutup yeniden çekin.");
            }
        }
        else
        {
            if (result.MarkersDetected is false || result.PerspectiveOk is false)
            {
                throw new OpticalScanRejectedException(
                    "Köşe işaretleri algılanamadı veya görüntü çok küçük; formu düz tutup yeniden çekin.");
            }
        }

        if (per == null || per.Count == 0)
            return;

        var bad = new List<int>();
        for (var i = 0; i < per.Count; i++)
        {
            var q = per[i];
            var st = (q.Status ?? "").Trim().ToLowerInvariant();
            // ambiguous: cevap boş kalır; tüm gönderimi reddetmek yerine kayda izin verilir.
            if (st == "ok" && q.Confidence < MinOkConfidence)
                bad.Add(i + 1);
        }

        if (bad.Count == 0)
            return;

        throw new OpticalScanRejectedException(
            $"Düşük güvenli okuma (sorular: {string.Join(", ", bad)}). Lütfen daha net bir fotoğraf çekin.");
    }
}
