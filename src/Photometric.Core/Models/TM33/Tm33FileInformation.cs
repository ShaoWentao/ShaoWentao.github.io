namespace Photometric.Core.Models.TM33;

/// <summary>
/// TM-33 FileInformation block (mandatory in TM-33-18).
/// Describes file-level metadata, not photometric data.
/// </summary>
public class Tm33FileInformation
{
    /// <summary>
    /// Generating software or system name.
    /// </summary>
    public string Creator { get; init; } = "Photometric Tools";

    /// <summary>
    /// Optional creator version.
    /// </summary>
    public string CreatorVersion { get; init; } = "1.0";

    /// <summary>
    /// Date/time the TM-33 file was generated.
    /// </summary>
    public DateTime Created { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Original source file name (e.g. IES file name).
    /// </summary>
    public string SourceFile { get; init; } = "";
}
