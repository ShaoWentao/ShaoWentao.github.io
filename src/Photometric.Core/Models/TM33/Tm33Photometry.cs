namespace Photometric.Core.Models.TM33;

public class Tm33Photometry
{
    public string Type { get; init; } = "C";
    public Tm33Angles Angles { get; init; } = new();
    public Tm33CandelaMatrix Candela { get; init; } = new();
}
