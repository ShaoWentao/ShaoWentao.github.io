namespace Photometric.Core.Models.Common;

/// <summary>
/// Candela intensity matrix. Convention:
/// Values[H, V] => first index is Horizontal (C-plane), second is Vertical (Gamma).
/// </summary>
public class CandelaMatrix
{
    public double[,] Values { get; init; } = new double[0, 0];
    public int HorizontalCount => Values.GetLength(0);
    public int VerticalCount => Values.GetLength(1);
}
