namespace Photometric.Core.Models;

/// <summary>
/// Candela intensity matrix.
/// Rows = horizontal angles, Columns = vertical angles.
/// </summary>
public class CandelaMatrix
{
    /// <summary>
    /// Candela values [H, V].
    /// </summary>
    public double[,] Values { get; init; } = new double[0, 0];

    public int HorizontalCount => Values.GetLength(0);
    public int VerticalCount => Values.GetLength(1);
}
