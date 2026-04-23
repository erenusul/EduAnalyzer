using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Exceptions;

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

    /// <summary>Türkçe sütun scan_metadata.alignment.alignment_score alt eşiği (ML zaten reddedebilir).</summary>
    public const double MinAlignmentScoreFromMetadata = 0.12;

    /// <summary>scan_metadata.turkish_column.confidence_mean için ek uyarı eşiği.</summary>
    public const double MinMeanConfidenceFromMetadata = 0.17;

    /// <summary>scan_metadata.turkish_column.ambiguous_count üst sınırı.</summary>
    public const int MaxAmbiguousCountFromMetadata = 16;

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

        EvaluateScanMetadata(result);

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

    private static void EvaluateScanMetadata(OpticalScanResultDto result)
    {
        if (!result.ScanMetadata.HasValue)
            return;

        var meta = result.ScanMetadata.Value;
        if (meta.ValueKind != JsonValueKind.Object)
            return;

        if (!meta.TryGetProperty("turkish_column", out var tc) || tc.ValueKind != JsonValueKind.Object)
            return;

        if (tc.TryGetProperty("alignment", out var al)
            && al.ValueKind == JsonValueKind.Object
            && al.TryGetProperty("alignment_score", out var scoreEl)
            && scoreEl.ValueKind == JsonValueKind.Number
            && scoreEl.TryGetDouble(out var alignmentScore)
            && alignmentScore < MinAlignmentScoreFromMetadata)
        {
            throw new OpticalScanRejectedException(
                "Optik form hizalaması yetersiz görünüyor. Telefonu düz tutup turuncu alanı çerçeveye hizalayarak yeniden deneyin.");
        }

        if (tc.TryGetProperty("ambiguous_count", out var ambEl)
            && ambEl.ValueKind == JsonValueKind.Number
            && ambEl.TryGetInt32(out var ambCount)
            && ambCount > MaxAmbiguousCountFromMetadata)
        {
            throw new OpticalScanRejectedException(
                "Çok sayıda satır belirsiz okundu. Daha net ve yakın bir fotoğraf çekin.");
        }

        if (tc.TryGetProperty("confidence_mean", out var cmEl)
            && cmEl.ValueKind == JsonValueKind.Number
            && cmEl.TryGetDouble(out var confMean)
            && confMean > 0
            && confMean < MinMeanConfidenceFromMetadata
            && result.PerQuestion is { Count: > 0 })
        {
            throw new OpticalScanRejectedException(
                "Optik okumanın genel güveni düşük. Işığı ve kadrajı iyileştirip tekrar deneyin.");
        }
    }
}
