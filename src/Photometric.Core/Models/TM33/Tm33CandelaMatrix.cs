namespace Photometric.Core.Models.TM33;

public class Tm33CandelaMatrix
{
    public double[,] Values { get; init; } = new double[0, 0];
    public int HorizontalCount => Values.GetLength(0);
    public int VerticalCount => Values.GetLength(1);
}
