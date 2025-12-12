namespace Photometric.Core.Models.TM33;

/// <summary>
/// Luminaire description in TM-33.
/// </summary>
public class Tm33Luminaire
{
    public string Manufacturer { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public string CatalogNumber { get; init; } = string.Empty;

    public double InputWatts { get; init; }
    public double TotalLumens { get; init; }
}
