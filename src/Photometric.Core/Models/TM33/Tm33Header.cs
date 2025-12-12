namespace Photometric.Core.Models.TM33;

/// <summary>
/// TM-33 document header.
/// </summary>
public class Tm33Header
{
    public string Standard { get; init; } = "TM-33-18";
    public string Laboratory { get; init; } = string.Empty;
    public string ReportNumber { get; init; } = string.Empty;
    public DateTime TestDate { get; init; }
}
