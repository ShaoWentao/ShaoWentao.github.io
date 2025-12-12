namespace Web.Services;

public class IesData
{
    public double[] VerticalAngles { get; set; } = [];
    public double[,] Candela { get; set; } = null!;

    public double PeakCandela { get; set; }
    public double BeamAngle { get; set; }
}
