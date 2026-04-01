namespace EduAnalyzer.Application.Exceptions;

/// <summary>
/// Optik okuma kesin sonuç politikası: hizalama veya soru bazlı güven koşulları sağlanmadığında.
/// </summary>
public sealed class OpticalScanRejectedException : Exception
{
    public OpticalScanRejectedException(string message)
        : base(message)
    {
    }
}
