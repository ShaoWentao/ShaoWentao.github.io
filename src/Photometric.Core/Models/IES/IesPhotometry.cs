namespace Photometric.Core.Models.IES;

public record IesPhotometry
{
    public int LampCount { get; init; }
    public double LumensPerLamp { get; init; }
    public double CandelaMultiplier { get; init; }

    public int VerticalAngleCount { get; init; }     // Nv
    public int HorizontalAngleCount { get; init; }   // Nh

    public int PhotometricType { get; init; }        // 1=C,2=B,3=A
    public int UnitsType { get; init; }              // 1=feet,2=meters

    public double Width { get; init; }
    public double Length { get; init; }
    public double Height { get; init; }

    public double BallastFactor { get; init; }
    public double FutureUse { get; init; }
    public double InputWatts { get; init; }
}
