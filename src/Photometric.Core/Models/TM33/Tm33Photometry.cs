public class Tm33Photometry
{
    public string Type { get; init; } = "C";

    public int NumberOfVerticalAngles { get; init; }
    public int NumberOfHorizontalAngles { get; init; }

    public Tm33Symmetry Symmetry { get; init; } = new();

    public Tm33Angles Angles { get; init; } = new();
    public Tm33CandelaMatrix Candela { get; init; } = new();
}
