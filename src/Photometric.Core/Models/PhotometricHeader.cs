namespace Photometric.Core.Models;

/// <summary>
/// Common photometric metadata shared across formats.
/// </summary>
public class PhotometricHeader
{
    public string Manufacturer { get; init; } = string.Empty;
    public string Luminaire { get; init; } = string.Empty;
    public string CatalogNumber { get; init; } = string.Empty;
    public string Lamp { get; init; } = string.Empty;

    public string TestLaboratory { get; init; } = string.Empty;
    public string TestReport { get; init; } = string.Empty;

    public double InputWatts { get; init; }
    public double TotalLumens { get; init; }

    public string Notes { get; init; } = string.Empty;
}
