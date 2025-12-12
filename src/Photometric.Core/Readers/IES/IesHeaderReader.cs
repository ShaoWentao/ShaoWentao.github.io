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

        // ------------------------------------------------------------------
        // 4. Photometric numeric header line
        // ------------------------------------------------------------------
        if (index >= lines.Length)
            throw new FormatException("Missing photometric header line.");

        var tokens = lines[index]
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (tokens.Length < 10)
            throw new FormatException("Invalid photometric header line.");

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

        iesHeader = iesHeader with
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

        index++;

        // ------------------------------------------------------------------
        // 5. Angle counts (vertical, horizontal)
        // ------------------------------------------------------------------
        if (index >= lines.Length)
            throw new FormatException("Missing angle count line.");

        var angleCountTokens = lines[index]
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (angleCountTokens.Length < 2)
            throw new FormatException("Invalid angle count line.");

        int verticalCount = ParseInt(angleCountTokens[0]);
        int horizontalCount = ParseInt(angleCountTokens[1]);

        index++;

        // ------------------------------------------------------------------
        // 6. Vertical angles
        // ------------------------------------------------------------------
        var verticalAngles = ReadAngleList(lines, ref index, verticalCount);

        // ------------------------------------------------------------------
        // 7. Horizontal angles
        // ------------------------------------------------------------------
        var horizontalAngles = ReadAngleList(lines, ref index, horizontalCount);

        // ------------------------------------------------------------------
        // 8. Build angle model
        // ------------------------------------------------------------------
        var angles = new PhotometricAngles
        {
            Vertical = verticalAngles,
            Horizontal = horizontalAngles,
            Type = photometry.PhotometricType switch
            {
                1 => "C",
                2 => "B",
                3 => "A",
                _ => "C"
            }
        };

        return new IesParseResult
        {
            CommonHeader = common,
            IesHeader = iesHeader,
            Angles = angles
        };
    }

    // ======================================================================
    // Helpers
    // ======================================================================

    private static IReadOnlyList<double> ReadAngleList(
        string[] lines,
        ref int index,
        int count)
    {
        var list = new List<double>(count);

        while (list.Count < count && index < lines.Length)
        {
            var tokens = lines[index]
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            foreach (var token in tokens)
            {
                if (list.Count < count)
                    list.Add(ParseDouble(token));
            }

            index++;
        }

        if (list.Count != count)
            throw new FormatException("Angle count mismatch.");

        return list;
    }

    private static int ParseInt(string value)
        => int.Parse(value, CultureInfo.InvariantCulture);

    private static double ParseDouble(string value)
        => double.Parse(value, CultureInfo.InvariantCulture);
}
