using System.Globalization;
using Photometric.Core.Models;
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Reads IES header section (before numeric photometric data).
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

        var common = new PhotometricHeader();
        var ies = new IesHeader();
        var tilt = new IesTilt();

        int index = 0;

        // ---- IES version (first line) ----
        ies = ies with { IesVersion = lines[index].Trim() };
        index++;

        // ---- Keyword section ----
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

        // ---- TILT line ----
        if (index < lines.Length && lines[index].StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
        {
            var tiltValue = lines[index][5..].Trim();

            if (tiltValue.Equals("NONE", StringComparison.OrdinalIgnoreCase))
            {
                tilt = tilt with { Type = "NONE" };
            }
            else if (tiltValue.Equals("INCLUDE", StringComparison.OrdinalIgnoreCase))
            {
                tilt = tilt with { Type = "INCLUDE" };
            }
            else
            {
                tilt = tilt with
                {
                    Type = "FILE",
                    FileName = tiltValue
                };
            }

            index++;
        }

        // ---- Numeric header line (photometry block header) ----
        // lamps, lumens/lamp, multiplier, etc.
        if (index < lines.Length)
        {
            var tokens = lines[index]
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (tokens.Length >= 10)
            {
                var photometry = new IesPhotometry
                {
                    LampCount = ParseInt(tokens[0]),
                    LumensPerLamp = ParseDouble(tokens[1]),
                    CandelaMultiplier = ParseDouble(tokens[2]),
                    PhotometricType = ParseInt(tokens[5]),
                    UnitsType = ParseInt(tokens[6]),
                    BallastFactor = ParseDouble(tokens[9]),
                    InputWatts = ParseDouble(tokens[^1])
                };

                ies = ies with
                {
                    Tilt = tilt,
                    Photometry = photometry,
                    Dimensions = new LuminaireDimensions
                    {
                        Width = ParseDouble(tokens[7]),
                        Length = ParseDouble(tokens[8]),
                        Height = ParseDouble(tokens[9])
                    }
                };

                common = common with
                {
                    InputWatts = photometry.InputWatts,
                    TotalLumens = photometry.LampCount * photometry.LumensPerLamp
                };
            }
        }

        return new IesParseResult
        {
            CommonHeader = common,
            IesHeader = ies
        };
    }

    private static int ParseInt(string value)
        => int.Parse(value, CultureInfo.InvariantCulture);

    private static double ParseDouble(string value)
        => double.Parse(value, CultureInfo.InvariantCulture);
}
