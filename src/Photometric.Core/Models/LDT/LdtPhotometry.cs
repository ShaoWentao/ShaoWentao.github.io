namespace Photometric.Core.Models.LDT;

/// <summary>
/// LDT (Eulumdat) photometric parameters.
/// </summary>
public class LdtPhotometry
{
    /// <summary>
    /// Measurement symmetry.
    /// </summary>
    public int Symmetry { get; init; }

    /// <summary>
    /// Number of C-planes.
    /// </summary>
    public int HorizontalAngleCount { get; init; }

    /// <summary>
    /// Number of Gamma angles.
    /// </summary>
    public int VerticalAngleCount { get; init; }

    /// <summary>
    /// Measurement type.
    /// </summary>
    public int MeasurementType { get; init; }
}
