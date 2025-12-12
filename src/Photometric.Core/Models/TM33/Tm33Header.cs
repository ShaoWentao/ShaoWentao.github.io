namespace Photometric.Core.Models.TM33;

public class Tm33Header
{
    public string Standard { get; init; } = "TM-33-18";
    public string Laboratory { get; init; } = "";
    public string ReportNumber { get; init; } = "";
    public DateTime? TestDate { get; init; }
}
