using System.Globalization;
using Photometric.Core.Models;
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Reads IES header and angular definitions (no candela data).
/// </summary>
public static class IesHeaderReader
{
    public static IesParseResult Parse(string iesText)
    {
        if (string.IsNullOrWhiteSpace(iesText))
            throw new ArgumentException("IES text is empty.");

        var lines = iesText
            .Replace("\r", string.Empty)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        int index = 0;

        var common = new PhotometricHeader();
        var iesHeader = new IesHeader();
        var tilt = new IesTilt();

        // ------------------------------------------------------------------
        // 1. IES version (first line)
        // ------------------------------------------------------------------
        iesHeader = iesHeader with
        {
            IesVersion = lines[index].Trim()
        };
        index++;

        // ------------------------------------------------------------------
        // 2. Keyword section
        // ------------------------------------------------------------------
        while (index < lines.Length)
        {
            var line = lines[index].Trim();

            if (line.StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
                break;

            if (line.StartsWith("[") && line.Contains(']'))
            {
                var end = line.IndexOf(']');
                var key = line[1..end].ToUpperInvariant();
                var value = line[(end + 1)..].Trim();

                common = key switch
                {
                    "MANUFAC" => common with { Manufacturer = value },
                    "LUMCAT" => common with { Luminaire = value },
                    "CATALOGNUMBER" => common with { CatalogNumber = value },
                    "LAMPCAT" => common with { Lamp = value },
                    "TESTLAB" => common with { TestLaboratory = value },
                    "TEST" => common with { TestReport = value },
                    "MORE" => common with { Notes = value },
                    _ => common
                };
            }

            index++;
        }

        // ------------------------------------------------------------------
        // 3. TILT line
        // ------------------------------------------------------------------
        if (index
