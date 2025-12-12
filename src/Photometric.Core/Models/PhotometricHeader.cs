namespace Photometric.Core.Models;

public record PhotometricHeader
{
    public string Manufacturer { get; init; } = "";
    public string Luminaire { get; init; } = "";
    public string CatalogNumber { get; init; } = "";
    public string Lamp { get; init; } = "";
    public string TestLaboratory { get; init; } = "";
    public string TestReport { get; init; } = "";
    public string Notes { get; init; } = "";
    public double InputWatts { get; init; }
    public double TotalLumens { get; init; }
}
