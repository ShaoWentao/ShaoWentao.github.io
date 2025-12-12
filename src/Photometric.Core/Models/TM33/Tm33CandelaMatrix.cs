namespace Photometric.Core.Models.TM33;

/// <summary>
/// Candela matrix for TM-33.
/// Rows = horizontal angles, Columns = vertical angles.
/// </summary>
public class Tm33CandelaMatrix
{
    public double[,] Values { get; init; } = new double[0, 0];

    public int HorizontalCount => Values.GetLength(0);
    public int VerticalCount => Values.GetLength(1);
}
