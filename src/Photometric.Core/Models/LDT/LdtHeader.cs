namespace Photometric.Core.Models.LDT;

/// <summary>
/// LDT-specific header extension.
/// </summary>
public class LdtHeader
{
    public string LuminaireName { get; init; } = string.Empty;
    public string Manufacturer { get; init; } = string.Empty;
    public string FileName { get; init; } = string.Empty;

    public LdtPhotometry Photometry { get; init; } = new();
}
