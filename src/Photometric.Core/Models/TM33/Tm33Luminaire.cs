namespace Photometric.Core.Models.TM33;

public class Tm33Luminaire
{
    public string Manufacturer { get; init; } = "";
    public string Model { get; init; } = "";
    public string CatalogNumber { get; init; } = "";

    public double InputWatts { get; init; }
    public double TotalLumens { get; init; }
}
