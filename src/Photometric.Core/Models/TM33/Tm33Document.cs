namespace Photometric.Core.Models.TM33;

/// <summary>
/// Root object of a TM-33-18 photometric document.
/// </summary>
public class Tm33Document
{
    public Tm33Header Header { get; init; } = new();
    public Tm33Luminaire Luminaire { get; init; } = new();
    public Tm33Photometry Photometry { get; init; } = new();
}
